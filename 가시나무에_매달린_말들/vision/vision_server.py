#!/usr/bin/env python3
"""
가시나무에 매달린 말들 — 관객 감지 서버

카메라(GoPro 웹캠 등)에서 사람을 한 명씩 분할·추적해서
사람 수, 위치(cx), 화면 속 키(h), 면적(area)을 웹소켓(ws://127.0.0.1:8770)으로 보낸다.
작품 화면(index.html)이 이 값을 받아 사람마다 새 한 마리를 짝지어 움직인다.

영상은 저장하지 않으며, 밖으로 나가는 것은 숫자 값뿐이다.

백엔드 (위에서부터 시도):
  sam3  : Meta SAM 3 (transformers, 텍스트 프롬프트 "person"으로 사람 분할 + 추적)
          → Hugging Face에서 facebook/sam3 접근 승인 + `hf auth login` 필요
  sam2  : YOLO로 사람을 찾아 추적(ByteTrack)하고 SAM 2.1로 사람 모양(마스크)을 잘라 면적 계산 (ultralytics)
  yolo  : YOLO 사람 감지 + 추적만 (가장 가벼움)
  mock  : 카메라 없이 가상의 관객 (화면 연출 확인용)

예)
  python vision_server.py                 # 자동 (sam3 → sam2 → yolo)
  python vision_server.py --backend sam2 --camera 1 --show
  python vision_server.py --list          # 쓸 수 있는 카메라 번호 확인
  python vision_server.py --backend mock  # 카메라 없이 테스트
"""
import argparse, asyncio, json, math, threading, time, sys, os

LATEST = {"backend": "", "t": 0, "count": 0, "people": []}
LOCK = threading.Lock()


def log(*a):
    print("[vision]", *a, flush=True)


# --------------------------------------------------------------------------- 웹소켓
def start_ws(port):
    import websockets

    clients = set()

    async def handler(ws, *args):
        clients.add(ws)
        try:
            async for _ in ws:
                pass
        finally:
            clients.discard(ws)

    async def broadcaster():
        while True:
            await asyncio.sleep(1 / 15)
            if not clients:
                continue
            with LOCK:
                msg = json.dumps(LATEST)
            for ws in list(clients):
                try:
                    await ws.send(msg)
                except Exception:
                    clients.discard(ws)

    async def main():
        async with websockets.serve(handler, "127.0.0.1", port):
            log(f"웹소켓 대기 중: ws://127.0.0.1:{port}")
            await broadcaster()

    threading.Thread(target=lambda: asyncio.run(main()), daemon=True).start()


def publish(backend, people):
    with LOCK:
        LATEST.update(backend=backend, t=time.time(), count=len(people), people=people)


# --------------------------------------------------------------------------- 카메라
def open_camera(index, width, height):
    import cv2
    api = cv2.CAP_AVFOUNDATION if sys.platform == "darwin" else cv2.CAP_ANY
    cap = cv2.VideoCapture(index, api)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    ok, _ = cap.read()
    if not ok:
        cap.release()
        return None
    return cap


def list_cameras():
    import cv2
    for i in range(6):
        cap = open_camera(i, 1280, 720)
        if cap:
            w, h = cap.get(cv2.CAP_PROP_FRAME_WIDTH), cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
            print(f"  카메라 {i}: {int(w)}x{int(h)}")
            cap.release()


def pick_camera(arg, width, height):
    if arg is not None:
        return open_camera(arg, width, height), arg
    # 자동: 높은 번호부터 (MacBook 내장 카메라는 보통 0번, 외부 GoPro는 그 뒤)
    for i in [1, 2, 3, 0]:
        cap = open_camera(i, width, height)
        if cap:
            return cap, i
    return None, None


def to_person(pid, box, W, H, area=None):
    x0, y0, x1, y1 = [float(v) for v in box]
    return {
        "id": int(pid),
        "cx": round(((x0 + x1) / 2) / W, 4),
        "cy": round(((y0 + y1) / 2) / H, 4),
        "h": round((y1 - y0) / H, 4),
        "area": round(area if area is not None else (x1 - x0) * (y1 - y0) / (W * H), 4),
    }


# --------------------------------------------------------------------------- 백엔드: SAM 3
class Sam3Backend:
    name = "sam3"

    def __init__(self, conf):
        import torch
        from transformers import Sam3VideoModel, Sam3VideoProcessor
        self.torch = torch
        self.dev = "cuda" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
        log(f"SAM 3 불러오는 중 ({self.dev}) — 처음엔 모델 내려받기로 몇 분 걸릴 수 있음")
        self.model = Sam3VideoModel.from_pretrained("facebook/sam3").to(self.dev).eval()
        self.proc = Sam3VideoProcessor.from_pretrained("facebook/sam3")
        self.conf = conf
        self.frames = 0
        self.empty_for = 0
        self._new_session()

    def _new_session(self):
        self.sess = self.proc.init_video_session(inference_device=self.dev, processing_device="cpu", video_storage_device="cpu")
        self.sess = self.proc.add_text_prompt(inference_session=self.sess, text="person")
        self.frames = 0

    def __call__(self, frame_bgr):
        import cv2
        H, W = frame_bgr.shape[:2]
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        with self.torch.inference_mode():
            inputs = self.proc(images=rgb, device=self.dev, return_tensors="pt")
            out = self.model(inference_session=self.sess, frame=inputs.pixel_values[0].to(self.dev), reverse=False)
            res = self.proc.postprocess_outputs(self.sess, out, original_sizes=inputs.original_sizes)
        people = []
        ids, scores, boxes, masks = res["object_ids"], res["scores"], res["boxes"], res["masks"]
        for k in range(len(ids)):
            if float(scores[k]) < self.conf:
                continue
            area = float(masks[k].float().mean()) if masks is not None else None
            people.append(to_person(ids[k], boxes[k].tolist(), W, H, area))
        # 스트리밍 세션은 프레임이 쌓이므로, 아무도 없을 때 가끔 새로 시작해 메모리를 비움
        self.frames += 1
        self.empty_for = self.empty_for + 1 if not people else 0
        if self.frames > 900 and self.empty_for > 30:
            self._new_session()
        return people


# --------------------------------------------------------------------------- 백엔드: SAM 2 (+YOLO 추적)
class Sam2Backend:
    name = "sam2"

    def __init__(self, conf, use_sam=True):
        from ultralytics import YOLO
        self.det = YOLO("yolo11n.pt")
        self.conf = conf
        self.sam = None
        if use_sam:
            from ultralytics import SAM
            for w in ("sam2.1_b.pt", "sam2_b.pt", "sam2.1_t.pt"):
                try:
                    self.sam = SAM(w)
                    log("SAM 2 모델:", w)
                    break
                except Exception as e:
                    log("SAM 2 모델 불러오기 실패:", w, e)
        if self.sam is None:
            self.name = "yolo"
        self.frames = 0
        self.areas = {}

    def __call__(self, frame):
        H, W = frame.shape[:2]
        r = self.det.track(frame, persist=True, classes=[0], conf=self.conf, verbose=False, tracker="bytetrack.yaml")[0]
        if r.boxes is None or r.boxes.id is None:
            return []
        boxes = r.boxes.xyxy.cpu().numpy().tolist()
        ids = r.boxes.id.int().cpu().numpy().tolist()
        # 사람 모양(마스크) 면적은 3프레임마다 SAM 2로 갱신
        self.frames += 1
        if self.sam is not None and self.frames % 3 == 0 and boxes:
            try:
                m = self.sam.predict(frame, bboxes=boxes, verbose=False)[0].masks
                if m is not None:
                    for pid, mk in zip(ids, m.data):
                        self.areas[pid] = float(mk.float().mean())
            except Exception as e:
                log("SAM 2 분할 실패, 상자 면적 사용:", e)
                self.sam = None
                self.name = "yolo"
        return [to_person(pid, b, W, H, self.areas.get(pid)) for pid, b in zip(ids, boxes)]


# --------------------------------------------------------------------------- 백엔드: 가상 관객
class MockBackend:
    name = "mock"

    def __init__(self):
        self.t0 = time.time()

    def __call__(self, _frame=None):
        t = time.time() - self.t0
        people = []
        n = int(1 + 1.5 * (1 + math.sin(t * 0.15)))          # 1~3명이 들어오고 나감
        for i in range(n):
            near = 0.5 + 0.45 * math.sin(t * 0.2 + i * 1.7)  # 다가왔다 멀어짐
            people.append({"id": i + 1, "cx": round(0.2 + 0.6 * (0.5 + 0.5 * math.sin(t * 0.07 + i * 2.1)), 4),
                           "cy": 0.6, "h": round(0.2 + 0.7 * near, 4), "area": round(0.02 + 0.2 * near, 4)})
        time.sleep(0.1)
        return people


def make_backend(kind, conf):
    order = {"auto": ["sam3", "sam2", "yolo"], "sam3": ["sam3", "sam2", "yolo"], "sam2": ["sam2", "yolo"], "yolo": ["yolo"], "mock": ["mock"]}[kind]
    for k in order:
        try:
            if k == "sam3":
                return Sam3Backend(conf)
            if k == "sam2":
                return Sam2Backend(conf, use_sam=True)
            if k == "yolo":
                return Sam2Backend(conf, use_sam=False)
            if k == "mock":
                return MockBackend()
        except Exception as e:
            log(f"{k} 사용 불가 → 다음 방식으로: {type(e).__name__}: {str(e)[:200]}")
    raise SystemExit("사용할 수 있는 감지 방식이 없습니다. setup_vision.command를 먼저 실행해 주세요.")


# --------------------------------------------------------------------------- 메인 루프
def main():
    ap = argparse.ArgumentParser(description="가시나무에 매달린 말들 — 관객 감지 서버")
    ap.add_argument("--backend", default="auto", choices=["auto", "sam3", "sam2", "yolo", "mock"])
    ap.add_argument("--camera", type=int, default=None, help="카메라 번호 (--list로 확인)")
    ap.add_argument("--list", action="store_true", help="카메라 번호 목록")
    ap.add_argument("--port", type=int, default=8770)
    ap.add_argument("--conf", type=float, default=0.35, help="사람으로 볼 최소 확신도")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--show", action="store_true", help="감지 확인 창 띄우기 (설치 점검용)")
    a = ap.parse_args()

    if a.list:
        list_cameras()
        return

    start_ws(a.port)
    backend = make_backend(a.backend, a.conf)
    log("감지 방식:", backend.name)

    if backend.name == "mock":
        while True:
            publish("mock", backend())

    import cv2
    cap, idx = pick_camera(a.camera, a.width, a.height)
    if cap is None:
        raise SystemExit("카메라를 열지 못했습니다. GoPro Webcam 앱이 켜져 있는지, --list로 번호를 확인해 주세요.")
    log(f"카메라 {idx}번 사용")

    fails, last_log = 0, 0
    while True:
        ok, frame = cap.read()
        if not ok:
            fails += 1
            if fails > 30:   # 케이블이 빠지거나 앱이 꺼진 경우: 다시 연결
                log("카메라 신호 없음 → 다시 연결")
                cap.release(); time.sleep(2)
                cap, idx = pick_camera(a.camera, a.width, a.height)
                fails = 0
                if cap is None:
                    publish(backend.name, []); time.sleep(2)
            continue
        fails = 0
        t = time.time()
        people = backend(frame)
        publish(backend.name, people)
        if time.time() - last_log > 5:
            last_log = time.time()
            log(f"{backend.name} · {len(people)}명 · {1/max(1e-3, time.time()-t):.1f} fps")
        if a.show:
            for p in people:
                H, W = frame.shape[:2]
                x, y, h = int(p["cx"] * W), int(p["cy"] * H), int(p["h"] * H)
                cv2.rectangle(frame, (x - h // 4, y - h // 2), (x + h // 4, y + h // 2), (160, 230, 160), 2)
                cv2.putText(frame, f'#{p["id"]} h{p["h"]:.2f}', (x - h // 4, y - h // 2 - 8), cv2.FONT_HERSHEY_SIMPLEX, .6, (160, 230, 160), 2)
            cv2.imshow("vision (q: quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break


if __name__ == "__main__":
    main()
