# Deployment Guide — Quiz App

## Yêu cầu
- Docker Engine + Docker Compose v2 (`docker compose version`)
- Ít nhất 2GB RAM trống (Postgres + Redis + backend + frontend)

## Triển khai nhanh (3 bước)

```bash
# 1. Copy file môi trường và điền secrets
cp .env.example .env
# Mở .env và thay 4 giá trị bắt buộc:
#   SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD, ADMIN_PASSWORD

# 2. Build + chạy toàn bộ stack
docker compose up -d --build

# 3. Kiểm tra trạng thái
docker compose ps
curl http://localhost:8000/health
```

## Dịch vụ

| Service   | Container       | Port mặc định | Ghi chú                              |
|-----------|-----------------|---------------|--------------------------------------|
| frontend  | quiz_frontend   | 80            | Nginx serve SPA + proxy `/api/`      |
| backend   | quiz_backend    | 8000          | FastAPI, health check `/health`      |
| postgres  | quiz_postgres   | 5432          | Data persist trong `postgres_data`   |
| redis     | quiz_redis      | 6379          | Có password, persist trong `redis_data` |

## Biến môi trường (.env)

Bắt buộc (compose sẽ từ chối chạy nếu thiếu):
- `SECRET_KEY` — tối thiểu 32 ký tự ngẫu nhiên (ký JWT)
- `POSTGRES_PASSWORD` — mật khẩu Postgres
- `REDIS_PASSWORD` — mật khẩu Redis
- `ADMIN_PASSWORD` — mật khẩu tài khoản admin seed ban đầu

Tùy chọn: `OPENAI_API_KEY`, `SMTP_*`, `FRONTEND_URL`, port overrides
(`BACKEND_PORT`, `FRONTEND_PORT`, `POSTGRES_PORT`, `REDIS_PORT`).

## Lệnh vận hành

```bash
docker compose logs -f backend      # xem log backend
docker compose logs -f frontend     # xem log nginx
docker compose down                 # dừng stack (giữ data)
docker compose down -v              # dừng + XÓA toàn bộ data
docker compose up -d --build backend  # rebuild riêng backend
```

## Lưu ý bảo mật
- Không commit file `.env` lên git (đã có trong `.gitignore` nếu repo dùng git).
- `docker-compose.yml` cũ hard-code `SECRET_KEY=supersecret_production_key_2026` — đã xóa, giờ bắt buộc đọc từ `.env`.
- Redis trong compose yêu cầu password (`--requirepass`); đảm bảo `REDIS_URL` backend dùng cùng password (compose tự ghép).
