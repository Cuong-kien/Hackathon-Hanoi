import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Heuristic auto-tag: quét mô tả + tên → sinh tag ngữ nghĩa. Không cần API key.
// (Nếu có OPENAI_API_KEY có thể nâng cấp gọi model; ở đây dùng heuristic cho ổn định demo.)
function buildTags(text) {
  const t = (text || "").toLowerCase();
  const hasKeyword = (kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(t);
  };
  const pick = (pairs) => pairs.filter(([, kws]) => kws.some(hasKeyword)).map(([v]) => v);

  const phongCach = pick([
    ["tối giản", ["tối giản", "minimal", "đơn giản"]],
    ["hiện đại", ["hiện đại", "modern"]],
    ["Scandinavian", ["scandinavian", "bắc âu"]],
    ["industrial", ["industrial", "công nghiệp", "chân sắt"]],
    ["Indochine", ["indochine", "đông dương"]],
    ["tân cổ điển", ["tân cổ điển", "cổ điển"]],
    ["trừu tượng", ["trừu tượng", "abstract"]],
    ["thuỷ mặc", ["thuỷ mặc", "thủy mặc"]],
    ["luxury", ["luxury", "sang trọng", "đẳng cấp", "xa hoa"]],
  ]);
  const mau = pick([
    ["gỗ", ["gỗ", "sồi", "tre"]], ["đen", ["đen", "nền đen"]], ["trắng", ["trắng"]],
    ["xám", ["xám"]], ["be", ["be", "kem"]], ["vàng", ["vàng", "mạ vàng", "dát vàng"]],
    ["xanh", ["xanh"]], ["đỏ", ["đỏ"]], ["hồng", ["hồng"]], ["pastel", ["pastel"]],
  ]);
  const phongHop = pick([
    ["bàn làm việc", ["bàn làm việc", "để bàn", "laptop"]], ["văn phòng", ["văn phòng", "công ty"]],
    ["phòng khách", ["phòng khách", "sofa"]], ["phòng ngủ", ["phòng ngủ", "đầu giường"]],
    ["phòng trà", ["phòng trà"]], ["phòng thờ", ["phòng thờ"]], ["lối vào", ["lối vào", "sảnh"]],
    ["quán cafe", ["cafe", "cà phê", "quán"]], ["khách sạn", ["khách sạn"]],
  ]);
  const congDung = pick([
    ["lọc không khí", ["lọc không khí", "thanh lọc", "oxy"]], ["công thái học", ["công thái học", "ergonomic", "đỡ lưng", "cột sống"]],
    ["chống cận", ["chống cận"]], ["tài lộc", ["tài lộc", "tiền tài", "vượng tài", "phú quý"]],
    ["may mắn", ["may mắn", "lộc"]], ["trường thọ", ["trường thọ", "diên niên"]],
    ["lưu trữ", ["lưu trữ", "hồ sơ", "ngăn kéo", "cất"]],
  ]);
  const menh = pick([
    ["Thủy", ["nước", "thác", "sóng", "biển", "thuỷ", "thủy"]],
    ["Mộc", ["cây", "gỗ", "lá", "hoa", "sen", "mộc"]],
    ["Kim", ["mạ vàng", "dát vàng", "kim loại", "đồng", "sắt"]],
    ["Hỏa", ["đỏ", "lửa", "mặt trời", "hoàng hôn"]],
    ["Thổ", ["gốm", "sứ", "đất", "đá"]],
  ]);

  const out = {};
  if (phongCach.length) out.phongCach = phongCach.join(", ");
  if (mau.length) out.mau = mau;
  if (phongHop.length) out.phongHop = phongHop;
  if (congDung.length) out.congDung = congDung;
  if (menh.length) out.menh = menh;
  return out;
}

export async function POST(req) {
  if (!(await isAuthed())) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  let body = {};
  try {
    body = await req.json();
  } catch {}
  const text = [body.name, body.desc, body.material, body.placementHint].filter(Boolean).join(". ");
  const tags = buildTags(text);
  return NextResponse.json({ ok: true, tags, source: "heuristic" });
}
