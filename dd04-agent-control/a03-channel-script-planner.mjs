// DD04 A03 — deterministic staging-only concept drafts, NOT an LLM or autonomous Agent.
import {createHash} from 'node:crypto';
export const A03_VERSION='0.1.0-STAGING-DRAFT';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ID=/^[A-Za-z0-9_-]{2,64}$/;
const content=[
 ['Bé làm sếp','Đảo vai','Bé giả làm giám đốc, mẹ là nhân viên',
 'Mẹ ơi, hôm nay con làm sếp nhé!','Sếp duyệt thực đơn bằng cái muỗng nhựa.','Mẹ hỏi: Sếp có duyệt giờ ngủ không?','Bé gật gù, rồi ngủ gục ngay trên ghế đồ chơi.','Sếp nhỏ duyệt hết, trừ giờ ngủ!'],
 ['Chiếc tất mất tích','Trinh thám','Hai mẹ con điều tra chiếc tất biến mất',
 'Ai lấy chiếc tất của con rồi?','Mẹ và bé soi dấu vết quanh thảm đồ chơi.','Bé phát hiện thủ phạm là chú gấu bông đang đội tất.','Bé thu hồi chiếc tất, rồi lại đội lên đầu mình.','Vụ án khép lại, thủ phạm mới xuất hiện!'],
 ['Quán cà phê của bé','Giả vờ nghề nghiệp','Bé mở quán nước bằng đồ chơi',
 'Quán con mở rồi, mẹ đặt món đi!','Mẹ gọi một ly cà phê, bé đưa cốc nước tưởng tượng.','Mẹ hỏi giá, bé chỉ vào một cái ôm.','Mẹ ôm bé; bé tuyên bố hôm nay miễn phí.','Thanh toán bằng ôm, ai cũng vui!'],
 ['Thi tài ngủ nhanh','Thử thách hài','Mẹ và bé đua xem ai giả ngủ giỏi hơn',
 'Ai ngủ nhanh hơn thì thắng nha!','Mẹ nhắm mắt diễn rất nghiêm túc.','Bé rón rén đắp khăn lên người mẹ.','Mẹ mở mắt, bé đang ngáy thật.','Giám khảo ngủ quên trước khi chấm điểm!'],
 ['Siêu nhân dọn đồ chơi','Siêu anh hùng đời thường','Bé nhận nhiệm vụ giải cứu phòng khách',
 'Báo động! Phòng khách cần siêu nhân!','Bé khoác áo choàng khăn mềm và chạy đến đống đồ chơi.','Mẹ đưa giỏ; bé tung từng món vào giỏ như cứu hộ.','Bé chiến thắng rồi kéo thêm xe đồ chơi ra chơi tiếp.','Siêu nhân dọn xong lại tạo nhiệm vụ mới!'],
 ['Bữa tiệc của gấu','Hội thoại thú bông','Bé làm chủ tiệc sinh nhật cho gấu',
 'Gấu ơi, thổi nến nào!','Bé bày bánh giả và mời mẹ làm khách.','Mẹ thổi nến đồ chơi, bé bảo phải để gấu thổi.','Bé tự làm tiếng phù phù cho gấu rồi cười khanh khách.','Gấu không nói mà vẫn là ngôi sao!'],
 ['Mẹ học tiếng bé','Hiểu nhầm đáng yêu','Mẹ phiên dịch tiếng bập bẹ của bé',
 'Hôm nay mẹ sẽ học ngoại ngữ của con!','Bé nói ba ba, mẹ đoán là muốn bóng.','Bé lắc đầu và chỉ vào cuốn sách.','Mẹ mở sách, bé reo lên như cô giáo chấm đúng.','Bài kiểm tra tiếng bé: mẹ vừa đủ điểm!'],
 ['Bé làm huấn luyện viên','Thể thao vui','Bé hướng dẫn mẹ tập thể dục',
 'Mẹ ơi, một hai ba, tập nào!','Bé giơ tay, mẹ bắt chước rất nghiêm.','Bé đổi động tác thành lắc lư nhảy vui.','Mẹ mệt, bé mang gấu bông ra thay ca.','Huấn luyện viên tập một phút, mẹ tập cả buổi!'],
 ['Đi tìm mặt trăng','Tưởng tượng kỳ ảo','Bé tìm mặt trăng trong những đồ vật tròn',
 'Mẹ ơi, trăng đi đâu rồi?','Bé thử so chiếc đĩa, cái vòng và quả bóng.','Mẹ chỉ lên cửa sổ có trăng sáng.','Bé lấy vòng tròn đặt cạnh cửa sổ để trăng có bạn.','Đêm nay mặt trăng có thêm người bạn!'],
 ['Bé sửa đồng hồ','Hài thời gian','Bé muốn tua nhanh đến giờ ăn vặt',
 'Đồng hồ ơi, đi nhanh lên!','Bé xoay đồng hồ đồ chơi, mẹ hỏi đang chỉnh giờ nào.','Bé đáp: Giờ ăn bánh! rồi đưa chiếc bánh đồ chơi.','Mẹ chỉ kim giờ ngủ, bé lập tức che mặt đồng hồ.','Có giờ ăn bánh, còn giờ ngủ thì tạm nghỉ!'],
 ['Rạp hát mini','Sân khấu','Bé mở rạp hát với vé bằng lá giấy',
 'Mời mẹ xem buổi diễn đặc biệt!','Mẹ trình vé giấy và ngồi ghế thấp.','Bé kéo rèm khăn và diễn vai chú thỏ nhảy múa.','Mẹ vỗ tay, bé yêu cầu thêm một lượt vé bằng ôm.','Rạp nhỏ mà tiếng cười thật to!'],
 ['Cuộc đua dép','Đồ vật biết nói hư cấu','Đôi dép đồ chơi thi chạy',
 'Đôi dép nào về đích trước nhỉ?','Bé xếp hai chiếc dép ở vạch giấy.','Mẹ đếm một hai ba, bé đẩy dép bằng ngón tay.','Một chiếc dép thắng rồi bé mang cả đôi về cất.','Đường đua kết thúc ở kệ dép!'],
 ['Bé làm nhiếp ảnh','Đóng vai nghệ sĩ','Bé chụp ảnh bằng máy ảnh đồ chơi',
 'Mẹ cười nào, con chụp nhé!','Mẹ làm đủ kiểu tạo dáng thật nghiêm túc.','Bé giơ máy ảnh giả lên rồi nói tách.','Mẹ hỏi hình đâu, bé chỉ vào trí nhớ và ôm mẹ.','Tấm ảnh đẹp nhất nằm trong trí nhớ!'],
 ['Chuyến tàu gối ôm','Phiêu lưu trong nhà','Bé lái tàu bằng gối mềm trong phòng khách',
 'Tàu chuẩn bị khởi hành, mẹ lên tàu!','Mẹ đưa vé là một nụ cười; bé bấm còi tu tu.','Tàu đi qua ga gấu bông và ga sách tranh.','Đến ga cuối, bé ngủ gục trên gối.','Tàu đã về bến mơ!'],
 ['Vương quốc bóng bay','Thế giới tưởng tượng','Bé xây vương quốc với bóng tròn đồ chơi',
 'Hôm nay con làm vua bóng bay!','Mẹ dựng cổng thành từ khối xốp mềm.','Bé đặt quả bóng làm mặt trời và gấu làm lính gác.','Gió nhẹ làm bóng lăn, bé tuyên bố trời sắp đi chơi.','Vương quốc nhỏ có khí hậu vui vẻ!'],
 ['Đầu bếp bất ngờ','Nấu ăn tưởng tượng','Bé nấu món soup bằng đồ chơi',
 'Mẹ ơi, món mới đây!','Bé cho khối đồ chơi vào nồi giả và khuấy đều.','Mẹ nếm bằng thìa đồ chơi rồi khen thơm quá.','Bé tiết lộ nguyên liệu bí mật là tiếng cười.','Món soup nấu bằng niềm vui!'],
 ['Phiên tòa đồ chơi','Hài tình huống','Bé xử vụ chiếc xe đồ chơi chạy lạc',
 'Ai cho xe chạy ra khỏi bãi đỗ?','Mẹ làm luật sư, gấu bông ngồi ghế nhân chứng.','Bé đưa chứng cứ là bánh xe còn quay.','Cuối cùng bé tha bổng vì xe chỉ muốn đi dạo.','Cả phiên tòa nhất trí đi chơi!'],
 ['Giải cứu cái bóng','Quan sát tự nhiên','Bé đuổi bắt cái bóng của chính mình',
 'Mẹ ơi, bạn nào đi theo con thế?','Bé bước sang trái, bóng bước sang trái.','Mẹ bật cười làm thử vài động tác vui.','Bé vẫy tay và bóng cũng vẫy tay.','Bé kết bạn với cái bóng rồi!'],
 ['Cửa hàng đổi nụ cười','Giao dịch hư cấu','Bé mở cửa hàng đồ chơi chỉ nhận nụ cười',
 'Mẹ mua gấu thì trả bằng gì?','Mẹ đưa đồng xu giả, bé lắc đầu.','Mẹ thử vỗ tay, bé vẫn lắc đầu.','Mẹ cười thật tươi, bé tặng gấu và ôm mẹ.','Giá niêm yết: một nụ cười!'],
 ['Ngày hội thời trang gấu','Biểu diễn dễ thương','Bé tổ chức trình diễn thời trang cho thú bông',
 'Xin mời người mẫu gấu bông!','Bé chọn khăn vải mềm làm áo choàng của gấu.','Mẹ làm MC giới thiệu bộ sưu tập cầu vồng.','Đến lượt bé lên sàn, bé đi ngược chiều và cười.','Sàn diễn nhỏ, niềm vui lớn!']
];
const normalize=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
function channelPlan(plan){
 if(!plan||typeof plan!=='object'||Array.isArray(plan))throw Error('PLAN_REQUIRED');
 const channels=plan.channels;
 if(!Array.isArray(channels)||channels.length<1||channels.length>20)throw Error('CHANNEL_COUNT_1_TO_20');
 const ids=new Set(),slugs=new Set();
 for(const ch of channels){
  if(!ch||typeof ch!=='object'||!ID.test(ch.channel_id||''))throw Error('CHANNEL_ID_INVALID');
  if(!['FANPAGE','TIKTOK'].includes(ch.platform))throw Error('PLATFORM_INVALID');
  if(ids.has(ch.channel_id))throw Error('CHANNEL_DUPLICATE');
  ids.add(ch.channel_id);
  if(typeof ch.name!=='string'||ch.name.trim().length<2||ch.name.length>100)throw Error('CHANNEL_NAME_INVALID');
  const slug=normalize(ch.name);
  if(slugs.has(slug)&&!plan.allow_same_display_name)throw Error('CHANNEL_DISPLAY_NAME_DUPLICATE');
  slugs.add(slug);
 }
 if(typeof plan.campaign_id!=='string'||!ID.test(plan.campaign_id))throw Error('CAMPAIGN_ID_INVALID');
 return channels;
}
const dialogue=(title,hook,beat,punch)=>[
 {from:0,to:4,visual:'Mở cảnh hoạt hình mẹ và bé hư cấu trong nhà Việt Nam, nhân vật nhất quán.',speech:hook},
 {from:4,to:12,visual:'Tình huống mở đầu: '+title+'.',speech:beat},
 {from:12,to:22,visual:'Cao trào hài bằng hành động và nét mặt; không gây nguy hiểm cho bé.',speech:null},
 {from:22,to:30,visual:'Kết thúc nhẹ nhàng, hình ảnh ấm áp và tiếng cười tự nhiên.',speech:punch}
];
export function planScripts(plan){
 const channels=channelPlan(plan);
 const slots=channels.map((ch,index)=>{
  const angle=content[index];
  if(!angle)throw Error('CREATIVE_CAPACITY_EXCEEDED');
  const [title,approach,story,hook,beat1,beat2,twist,punch]=angle;
  const fullBeat=beat1+' '+beat2+' '+twist;
  const identity={campaign_id:plan.campaign_id,channel_id:ch.channel_id,platform:ch.platform,revision:1};
  const scenes=dialogue(title,hook,fullBeat,punch);
  return {...identity,script_id:'a03_'+hash(identity).slice(0,20),status:'DRAFT_STAGING_NOT_EXECUTED',
   creative:{title,approach,story,hook,beats:[beat1,beat2,twist],punchline:punch},
   duration_seconds:30,scenes,caption:'Một khoảnh khắc mẹ và bé thật đáng yêu: '+title+'! #MeVaBe #HoatHinhViet',
   video_brief:{format:'9:16',style:'Hoạt hình hư cấu Việt Nam, nhân vật mẹ và bé 0–36 tháng, không sao chép người thật',duration_seconds:30},
   reply_library:{positive:['Cảm ơn bạn đã xem! Mẹ và bé trong video là nhân vật hoạt hình hư cấu nhé.'],
     question:['Đây là câu chuyện hoạt hình do đội ngũ xây dựng, không phải cảnh quay em bé thật.'],
     criticism:['Cảm ơn bạn góp ý. Chúng tôi sẽ xem xét để nội dung phù hợp và tự nhiên hơn.']},
   review:{A08:'PENDING',A09:'PENDING',G1:'NOT_APPROVED',G2:'NOT_APPROVED'},publishing_allowed:false,
   fingerprint:hash({identity,title,approach,story,scenes})};
 });
 const approaches=slots.map(x=>normalize(x.creative.approach));
 const titles=slots.map(x=>normalize(x.creative.title));
 if(new Set(approaches).size!==slots.length||new Set(titles).size!==slots.length)throw Error('CREATIVE_DUPLICATION');
 return {schema_version:'5.3',generator:'A03_STAGING_TEMPLATE_PREVIEW',real_llm_execution:false,
 campaign_id:plan.campaign_id,channel_count:channels.length,script_count:slots.length,
 status:'PRE_G1_DRAFT_NO_AGENT_EXECUTION',scripts:slots,
 audit:{event:'STAGING_DRAFT_GENERATED',owner_agent:'A03',channel_count:channels.length,content_sha256:hash(slots)},
 handoff:{A04:'BLOCKED_G1',A05:'BLOCKED_G1',A08:'AWAITING_REVIEW',A09:'AWAITING_REVIEW',A07:'DENIED_G2_NOT_APPROVED'}};
}
