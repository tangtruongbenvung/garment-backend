// DD04 A00-032: pure presentation. No HTTP, database writes, auth or worker action.
const agents=[
 ['A00','Điều phối','Nhận lệnh CEO, chia nhiệm vụ, bảo toàn version/hash và nhật ký bàn giao.'],
 ['A01','Trend','Tìm chủ đề giải trí phù hợp, không xem dữ liệu minh họa như số liệu thật.'],
 ['A02','Chiến lược kênh','Khóa định vị và bản sắc riêng cho 10 Fanpage + 10 TikTok.'],
 ['A03','Kịch bản','Viết đối thoại mẹ–bé tiếng Việt gần gũi, hài hước và đúng độ tuổi.'],
 ['A04','Nhân vật & ảnh','Giữ Character Bible, ảnh tham chiếu, góc máy và mã SHA từng kênh.'],
 ['A05','Video & giọng','Dựng chuyển động nhân vật, lời thoại và phụ đề; cần nguồn media hợp lệ.'],
 ['A06','Quản lý kênh','Theo dõi hồ sơ kênh, quyền tài khoản và lịch nội dung nháp.'],
 ['A07','Đăng bài','Chỉ đăng đúng asset/kênh/lịch sau CEO G2 và có quyền nền tảng.'],
 ['A08','Kiểm soát chất lượng','Kiểm ảnh/video thật, nhất quán khuôn mặt, chuyển động và âm thanh.'],
 ['A09','Tuân thủ','Kiểm tiếng Việt, văn hóa gia đình, an toàn trẻ và bản quyền.'],
 ['A10','Phân tích kênh','Đánh giá dữ liệu thật sau khi có nội dung được đăng.'],
 ['A11','KPI & chi phí','Theo dõi chi phí thực đã phát sinh, không gây phê duyệt lặp lại cho nội dung miễn phí.'],
 ['A12','Đối thủ','Phân tích nội dung công khai, không sao chép bản quyền.'],
 ['A13','Viral curator','Lọc ý tưởng nổi bật và độ phù hợp với kênh.'],
 ['A14','Bán hàng','Chỉ giới thiệu sản phẩm có SKU, giá và tồn kho đã xác minh.'],
 ['A15','Chăm sóc khách','Trả lời đúng thông tin, tự nhiên, không cam kết sai.'],
 ['A16','ANT Listening','Lắng nghe phản hồi thực, không lập đánh giá giả.'],
 ['A17','ANT Engagement','Tương tác lịch sự, không spam hoặc giả người xem.']
];
const $=id=>document.getElementById(id);
const grid=$('agentGrid');
const activate=(id)=>{
 const a=agents.find(x=>x[0]===id);
 if(!a)return;
 $('agentCode').textContent=a[0];
 $('agentName').textContent=a[1];
 $('agentDesc').textContent=a[2];
 document.querySelectorAll('[data-agent]').forEach(el=>{
  el.classList.toggle('active',el.dataset.agent===id);
  el.setAttribute('aria-pressed',String(el.dataset.agent===id));
 });
};
for(const [id,label] of agents){
 const b=document.createElement('button');
 b.className='agent-card';
 b.type='button';
 b.dataset.agent=id;
 const title=document.createElement('b');title.textContent=id;
 const sub=document.createElement('small');sub.textContent=label;
 b.append(title,sub);
 b.addEventListener('click',()=>activate(id));grid.append(b);
}
document.querySelectorAll('.node').forEach(n=>n.addEventListener('click',()=>activate(n.dataset.agent)));
$('reduceMotion').addEventListener('click',()=>{
 const reduced=document.body.classList.toggle('reduced');
 $('reduceMotion').textContent=reduced?'Bật chuyển động':'Tắt chuyển động';
 $('reduceMotion').setAttribute('aria-pressed',String(reduced));
});
activate('A00');
// No simulated random metrics: real backend data must be loaded through a
// separately authorized CEO AAL2 read-only endpoint with transparent provenance.
