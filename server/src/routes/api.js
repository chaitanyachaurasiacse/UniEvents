import {Router} from 'express';import crypto from 'crypto';import {body,validationResult} from 'express-validator';import {User,Club,Category,Event,Registration,Attendance,Notification,AuditLog} from '../models/index.js';import {protect,allowRoles,ownerOrAdmin} from '../middleware/auth.js';import {signToken,hashPassword,comparePassword,notify,audit,fail,asyncHandler} from '../utils/core.js';
const r=Router();const PW_RE=/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/;const sha=t=>crypto.createHash('sha256').update(String(t)).digest('hex');const esc=t=>String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const roleList=u=>[u.role,...(u.extraRoles||[])];const allowedClient=()=>(process.env.CLIENT_URL||'http://localhost:5173').split(',')[0].trim().replace(/\/$/,'');const validate=(req,res,next)=>{const e=validationResult(req);if(!e.isEmpty())return fail(res,422,'Please correct the highlighted fields.','VALIDATION',e.array());next();};const safe=u=>({id:u._id,name:u.name,email:u.email,role:u.role,extraRoles:u.extraRoles,department:u.department,year:u.year,rollNumber:u.rollNumber,phone:u.phone,bio:u.bio,roles:roleList(u),notificationPreferences:u.notificationPreferences});
// Authentication
r.post('/auth/register',[body('name').trim().isLength({min:2,max:60}),body('email').isEmail(),body('rollNumber').isAlphanumeric().isLength({min:6,max:15}),body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/),body('confirmPassword').custom((v,{req})=>v===req.body.password),validate],asyncHandler(async(req,res)=>{const email=req.body.email.toLowerCase().trim();const doms=(process.env.UNIVERSITY_DOMAINS||'').split(',').map(d=>d.trim().toLowerCase()).filter(Boolean);if(doms.length&&!doms.includes(email.split('@')[1]))return fail(res,422,'Use your university e-mail address to create an account.','VALIDATION');if(await User.findOne({$or:[{email},{rollNumber:req.body.rollNumber}]}))return fail(res,409,'An account with this email or roll number already exists.','DUPLICATE');const u=await User.create({name:req.body.name,email,rollNumber:req.body.rollNumber,passwordHash:await hashPassword(req.body.password),role:'student',department:req.body.department||'Computer Science & Engineering',year:req.body.year||'1st Year'});res.status(201).json({success:true,message:'Account created. You are now signed in.',user:safe(u),token:signToken(u)});}));
r.post('/auth/login',asyncHandler(async(req,res)=>{const email=(req.body.email||'').toLowerCase().trim(),u=await User.findOne({email});if(!u)return fail(res,401,'The credentials entered are incorrect.','INVALID_CREDENTIALS');if(u.lockedUntil>Date.now())return fail(res,423,'Too many unsuccessful attempts. Try again later.','ACCOUNT_LOCKED');if(!u.isActive)return fail(res,403,'This account has been deactivated. Contact the administrator.','ACCOUNT_INACTIVE');if(!await comparePassword(req.body.password||'',u.passwordHash)){u.failedLoginAttempts++;if(u.failedLoginAttempts>=5){u.lockedUntil=new Date(Date.now()+15*60*1000);u.failedLoginAttempts=0;}await u.save();return fail(res,401,'The credentials entered are incorrect.','INVALID_CREDENTIALS');}u.failedLoginAttempts=0;u.lockedUntil=null;u.lastLoginAt=new Date();await u.save();res.json({success:true,token:signToken(u),user:safe(u)});}));
r.get('/auth/me',protect,(req,res)=>res.json({success:true,user:safe(req.user)}));r.post('/auth/logout',protect,(req,res)=>res.json({success:true,message:'Signed out'}));
r.post('/auth/forgot-password',asyncHandler(async(req,res)=>{
  const email=(req.body.email||'').toLowerCase().trim();
  const u=email?await User.findOne({email,isActive:true}):null;
  let resetUrl;
  if(u){
    const raw=crypto.randomBytes(32).toString('hex');
    u.resetTokenHash=sha(raw);u.resetTokenExpires=new Date(Date.now()+30*60*1000);await u.save();
    // No mail server is configured. In demo mode the link is shown on screen instead of being e-mailed.
    if(process.env.DEMO_RESET_LINKS==='true')resetUrl=`${allowedClient()}/reset?token=${raw}`;
  }
  res.json({success:true,message:'If this e-mail is registered, a password reset link has been sent.',resetUrl});
}));
r.post('/auth/reset-password',asyncHandler(async(req,res)=>{
  const {token,password,confirmPassword}=req.body;
  if(!PW_RE.test(password||''))return fail(res,422,'Password must be 8–20 characters with upper-case, lower-case, a digit and a special character.','VALIDATION');
  if(password!==confirmPassword)return fail(res,422,'The passwords entered do not match.','VALIDATION');
  const u=await User.findOne({resetTokenHash:sha(token||''),resetTokenExpires:{$gt:new Date()}});
  if(!u)return fail(res,400,'This reset link is invalid or has expired.','INVALID_TOKEN');
  u.passwordHash=await hashPassword(password);u.resetTokenHash=undefined;u.resetTokenExpires=undefined;u.failedLoginAttempts=0;u.lockedUntil=null;await u.save();
  res.json({success:true,message:'Your password has been reset. You can now sign in.'});
}));
// Public-to-authenticated event directory
r.get('/events',protect,asyncHandler(async(req,res)=>{const q={status:{$in:['Approved','Ongoing','Completed','Cancelled']}};if(req.query.q)q.$or=[{title:new RegExp(esc(req.query.q),'i')},{description:new RegExp(esc(req.query.q),'i')},{venue:new RegExp(esc(req.query.q),'i')}];if(req.query.category)q.category=req.query.category;if(req.query.from||req.query.to)q.startAt={...(req.query.from?{$gte:new Date(req.query.from)}:{}),...(req.query.to?{$lte:new Date(req.query.to)}:{})};if(req.query.status)q.status=req.query.status;if(req.query.upcoming==='true'){q.status={$in:['Approved','Ongoing']};q.endAt={$gte:new Date()};}if(req.query.scope==='all'&&req.user.role==='admin'&&!req.query.status)delete q.status;const page=Math.max(1,+req.query.page||1),limit=Math.min(50,+req.query.limit||12);const [items,total]=await Promise.all([Event.find(q).populate('category','name colour').populate('organizer','name role').sort(req.query.sort==='date'?'startAt':'-createdAt').skip((page-1)*limit).limit(limit),Event.countDocuments(q)]);res.json({success:true,items,total,page,pages:Math.ceil(total/limit)});}));
r.get('/events/featured',protect,asyncHandler(async(req,res)=>res.json({success:true,items:await Event.find({status:'Approved',featured:true,startAt:{$gte:new Date()}}).populate('category','name colour').sort('startAt').limit(5)})));
r.get('/events/mine',protect,allowRoles('faculty','club'),asyncHandler(async(req,res)=>res.json({success:true,items:await Event.find({organizer:req.user._id}).populate('category','name colour').sort('-createdAt')})));
r.get('/events/pending',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.json({success:true,items:await Event.find({status:'Pending'}).populate('organizer','name email role').populate('category','name colour').sort('submittedAt')})));
r.get('/events/:id',protect,asyncHandler(async(req,res)=>{const e=await Event.findById(req.params.id).populate('category','name colour').populate('organizer','name email').populate('club','name');if(!e)return fail(res,404,'Event not found','NOT_FOUND');if(['Draft','Pending','Rejected','Changes Requested'].includes(e.status)&&req.user.role!=='admin'&&String(e.organizer._id)!==String(req.user._id))return fail(res,404,'Event not found','NOT_FOUND');const registration=req.user.role==='student'?await Registration.findOne({event:e._id,student:req.user._id,status:{$ne:'Cancelled'}}):null;res.json({success:true,event:e,registration});}));
const eventFields=['title','summary','description','category','venue','startAt','endAt','registrationOpensAt','registrationDeadline','capacity','club','featured','waitlistEnabled','imageUrl','eligibility'];
r.post('/events',protect,allowRoles('faculty','club'),asyncHandler(async(req,res)=>{const data={};for(const k of eventFields)if(req.body[k]!==undefined)data[k]=req.body[k];data.organizer=req.user._id;if(data.startAt&&data.endAt&&new Date(data.endAt)<=new Date(data.startAt))return fail(res,422,'The end time must be after the start time.','INVALID_DATES');if(req.user.role==='club'&&!data.club){const c=await Club.findOne({coordinator:req.user._id,isActive:true});if(c)data.club=c._id;}if(!data.club)delete data.club;const e=await Event.create(data);e.statusHistory.push({status:'Draft',by:req.user._id});await e.save();res.status(201).json({success:true,event:e});}));
r.put('/events/:id',protect,ownerOrAdmin,asyncHandler(async(req,res)=>{const e=req.event;if(req.user.role!=='admin'&&!['Draft','Changes Requested','Rejected','Approved'].includes(e.status))return fail(res,409,'This event cannot be edited in its current status.','INVALID_STATE');const old={venue:e.venue,startAt:e.startAt,endAt:e.endAt,description:e.description};for(const k of eventFields)if(req.body[k]!==undefined&&!(k==='club'&&!req.body[k]))e[k]=req.body[k];if(new Date(e.endAt)<=new Date(e.startAt))return fail(res,422,'The end time must be after the start time.','INVALID_DATES');if(e.capacity<e.registeredCount)return fail(res,422,'Capacity cannot be lower than the number of registered participants.','VALIDATION');if(e.status==='Approved'&&(old.venue!==e.venue||String(old.startAt)!==String(e.startAt)||String(old.endAt)!==String(e.endAt)||old.description!==e.description)){e.status='Pending';e.submittedAt=new Date();e.statusHistory.push({status:'Pending',by:req.user._id,note:'Major change requires re-approval'});const admins=await User.find({role:'admin',isActive:true});for(const a of admins)await notify(a._id,'Event resubmitted',`${e.title} requires review.`,'approval',e._id);}await e.save();res.json({success:true,event:e});}));
r.post('/events/:id/submit',protect,ownerOrAdmin,asyncHandler(async(req,res)=>{const e=req.event;if(!['Draft','Changes Requested','Rejected'].includes(e.status))return fail(res,409,'This event cannot be submitted in its current status.','INVALID_STATE');if(!e.title||!e.summary||!e.description||!e.category||!e.venue||!e.startAt||!e.endAt||!e.registrationDeadline||!e.capacity)return fail(res,422,'Complete all required event fields before submitting.','VALIDATION');if(new Date(e.endAt)<=new Date(e.startAt)||new Date(e.registrationDeadline)>new Date(e.startAt))return fail(res,422,'Check the event dates and registration deadline.','INVALID_DATES');if(e.changeRequestCount>3)return fail(res,409,'The maximum number of change requests has been reached.','LIMIT');e.status='Pending';e.submittedAt=new Date();e.statusHistory.push({status:'Pending',by:req.user._id});await e.save();for(const a of await User.find({role:'admin',isActive:true}))await notify(a._id,'New event submitted',`${e.title} is awaiting review.`,'approval',e._id);res.json({success:true,event:e});}));
r.put('/events/:id/approve',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const e=await Event.findById(req.params.id);if(!e)return fail(res,404,'Event not found');if(String(e.organizer)===String(req.user._id))return fail(res,403,'An administrator cannot approve their own event.');if(e.status!=='Pending')return fail(res,409,'Only pending events can be approved.');e.status='Approved';e.approvedBy=req.user._id;e.reviewedAt=new Date();e.statusHistory.push({status:'Approved',by:req.user._id});await e.save();await notify(e.organizer,'Event approved',`Your event ${e.title} has been approved and published.`,'approval',e._id);await audit(req.user._id,'approve','Event',e._id,{},req.ip);res.json({success:true,event:e});}));
r.put('/events/:id/reject',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const reason=(req.body.reason||'').trim();if(reason.length<20)return fail(res,422,'A rejection reason of at least 20 characters is required.');const e=await Event.findById(req.params.id);if(!e||e.status!=='Pending')return fail(res,404,'Pending event not found.');e.status='Rejected';e.rejectionReason=reason;e.reviewedAt=new Date();e.statusHistory.push({status:'Rejected',by:req.user._id,note:reason});await e.save();await notify(e.organizer,'Event rejected',`${e.title}: ${reason}`,'approval',e._id);await audit(req.user._id,'reject','Event',e._id,{reason},req.ip);res.json({success:true,event:e});}));
r.put('/events/:id/request-changes',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const comment=(req.body.comment||'').trim();if(comment.length<10)return fail(res,422,'Please provide a useful change request.');const e=await Event.findById(req.params.id);if(!e||e.status!=='Pending')return fail(res,404,'Pending event not found.');if(e.changeRequestCount>=3)return fail(res,409,'The maximum number of change requests has been reached.');e.status='Changes Requested';e.reviewComment=comment;e.changeRequestCount++;e.statusHistory.push({status:'Changes Requested',by:req.user._id,note:comment});await e.save();await notify(e.organizer,'Changes requested',`${e.title}: ${comment}`,'approval',e._id);res.json({success:true,event:e});}));
r.put('/events/:id/cancel',protect,ownerOrAdmin,asyncHandler(async(req,res)=>{const e=req.event;const reason=(req.body.reason||'').trim();if(reason.length<5)return fail(res,422,'Please give a reason for cancelling the event.');if(['Completed','Archived','Cancelled'].includes(e.status))return fail(res,409,'This event cannot be cancelled.');e.status='Cancelled';e.cancelReason=reason;e.statusHistory.push({status:'Cancelled',by:req.user._id,note:reason});await e.save();const regs=await Registration.find({event:e._id,status:{$in:['Confirmed','Waitlisted']}});for(const reg of regs)await notify(reg.student,`${e.title} cancelled`,`The event has been cancelled. Reason: ${reason}`,'cancellation',e._id);res.json({success:true,event:e});}));
r.put('/events/:id/complete',protect,ownerOrAdmin,asyncHandler(async(req,res)=>{const e=req.event;if(new Date()<new Date(e.endAt))return fail(res,409,'An event can be closed only after its scheduled end time.');e.status='Completed';e.statusHistory.push({status:'Completed',by:req.user._id});await e.save();res.json({success:true,event:e});}));
// Registration and attendance
r.post('/events/:id/register',protect,allowRoles('student'),asyncHandler(async(req,res)=>{
  const e=await Event.findById(req.params.id);
  if(!e)return fail(res,404,'Event not found');
  if(e.status!=='Approved'&&e.status!=='Ongoing')return fail(res,409,'Registration is not available for this event.');
  const now=new Date();
  if(e.registrationOpensAt&&now<e.registrationOpensAt)return fail(res,409,'Registration has not opened yet.');
  if(now>e.registrationDeadline)return fail(res,409,'Registration for this event has closed.');
  if(e.eligibility?.departments?.length&&!e.eligibility.departments.includes(req.user.department))return fail(res,403,'You are not eligible for this event.');
  if(e.eligibility?.years?.length&&!e.eligibility.years.includes(req.user.year))return fail(res,403,'You are not eligible for this event.');
  const existing=await Registration.findOne({event:e._id,student:req.user._id});
  if(existing&&existing.status!=='Cancelled')return fail(res,409,'You are already registered for this event.');
  let status='Confirmed',waitlistPosition=null;
  // Atomic seat reservation: only succeeds while registeredCount < capacity, so two simultaneous requests cannot over-book.
  let fresh=await Event.findOneAndUpdate({_id:e._id,$expr:{$lt:['$registeredCount','$capacity']}},{$inc:{registeredCount:1}},{new:true});
  if(!fresh){
    if(!e.waitlistEnabled)return fail(res,409,'Registration is currently full.');
    status='Waitlisted';
    fresh=await Event.findByIdAndUpdate(e._id,{$inc:{waitlistCount:1}},{new:true});
    waitlistPosition=fresh.waitlistCount;
  }
  let reg;
  try{
    if(existing){existing.status=status;existing.registeredAt=new Date();existing.cancelledAt=null;existing.waitlistPosition=waitlistPosition;reg=await existing.save();}
    else reg=await Registration.create({event:e._id,student:req.user._id,status,waitlistPosition});
  }catch(err){
    await Event.updateOne({_id:e._id},{$inc:status==='Confirmed'?{registeredCount:-1}:{waitlistCount:-1}});
    throw err;
  }
  await notify(req.user._id,status==='Confirmed'?'Registration confirmed':'Added to waitlist',`${req.user.name}, your status for ${e.title} is ${status}.`,'registration',e._id);
  if(status==='Confirmed'&&fresh.registeredCount>=Math.ceil(fresh.capacity*.9))await notify(e.organizer,`${e.title} is 90% full`,`${fresh.registeredCount} of ${fresh.capacity} seats are filled.`,'capacity',e._id);
  res.status(201).json({success:true,registration:reg,registeredCount:fresh.registeredCount});
}));
r.delete('/events/:id/register',protect,allowRoles('student'),asyncHandler(async(req,res)=>{
  const reg=await Registration.findOneAndUpdate({event:req.params.id,student:req.user._id,status:{$in:['Confirmed','Waitlisted']}},{$set:{status:'Cancelled',cancelledAt:new Date()}},{new:false});
  if(!reg)return fail(res,404,'Active registration not found.');
  const wasConfirmed=reg.status==='Confirmed';
  reg.status='Cancelled';
  const e=await Event.findById(req.params.id);
  if(!e)return fail(res,404,'Event not found');
  if(wasConfirmed){
    let promoted=null;
    if(e.waitlistEnabled)promoted=await Registration.findOneAndUpdate({event:e._id,status:'Waitlisted'},{$set:{status:'Confirmed',waitlistPosition:null}},{sort:{registeredAt:1},new:true});
    if(promoted)await notify(promoted.student,'A seat is now available',`You have been moved from the waitlist into ${e.title}.`,'waitlist',e._id);
    else await Event.updateOne({_id:e._id,registeredCount:{$gt:0}},{$inc:{registeredCount:-1}});
  }
  await notify(req.user._id,'Registration cancelled',`Your registration for ${e.title} has been cancelled.`,'registration',e._id);
  res.json({success:true,registration:reg});
}));
r.get('/registrations/me',protect,allowRoles('student'),asyncHandler(async(req,res)=>res.json({success:true,items:await Registration.find({student:req.user._id}).populate({path:'event',populate:{path:'category',select:'name colour'}}).sort('-createdAt')})));
r.get('/events/:id/participants',protect,allowRoles('faculty','club','admin'),asyncHandler(async(req,res)=>{const e=await Event.findById(req.params.id);if(!e)return fail(res,404,'Event not found');if(req.user.role!=='admin'&&String(e.organizer)!==String(req.user._id))return fail(res,403,'You can view participants of your own events only.');res.json({success:true,items:await Registration.find({event:e._id}).populate('student','name email rollNumber department year').sort('registeredAt')});}));
r.put('/registrations/:id/attendance',protect,allowRoles('faculty','club','admin'),asyncHandler(async(req,res)=>{const reg=await Registration.findById(req.params.id).populate('event');if(!reg)return fail(res,404,'Registration not found');if(req.user.role!=='admin'&&String(reg.event.organizer)!==String(req.user._id))return fail(res,403,'You cannot mark attendance for this event.');if(reg.status==='Cancelled'||reg.status==='Waitlisted')return fail(res,409,'Only confirmed participants can have attendance marked.');const status=req.body.status==='Not attended'?'Not attended':'Attended';reg.status=status;await reg.save();const att=await Attendance.findOneAndUpdate({registration:reg._id},{event:reg.event._id,registration:reg._id,student:reg.student,markedBy:req.user._id,status,markedAt:new Date()},{upsert:true,new:true});res.json({success:true,attendance:att,registration:reg});}));
// Users, clubs, categories
r.get('/users',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.json({success:true,items:await User.find().select('-passwordHash').sort('name')})));
r.post('/users',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{if(!['faculty','club','admin'].includes(req.body.role))return fail(res,422,'Invalid staff role.');const u=await User.create({name:req.body.name,email:req.body.email.toLowerCase(),passwordHash:await hashPassword(req.body.password||'Welcome@123'),role:req.body.role,department:req.body.department,employeeId:req.body.employeeId,isVerified:true});res.status(201).json({success:true,user:safe(u)});}));
r.put('/users/:id/status',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const u=await User.findById(req.params.id);if(!u)return fail(res,404,'User not found');if(u.role==='admin'&&req.body.isActive===false&&(await User.countDocuments({role:'admin',isActive:true}))<=1)return fail(res,409,'The last administrator cannot be deactivated.');u.isActive=!!req.body.isActive;await u.save();res.json({success:true,user:safe(u)});}));
r.get('/clubs',protect,asyncHandler(async(req,res)=>res.json({success:true,items:await Club.find({isActive:true}).populate('coordinator','name').populate('facultyAdvisor','name')})));
r.post('/clubs',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.status(201).json({success:true,club:await Club.create(req.body)})));
r.put('/clubs/:id',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.json({success:true,club:await Club.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true})})));
r.get('/categories',protect,asyncHandler(async(req,res)=>res.json({success:true,items:await Category.find({isActive:true}).sort('order name')})));
r.post('/categories',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.status(201).json({success:true,category:await Category.create(req.body)})));
r.put('/categories/:id',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.json({success:true,category:await Category.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true})})));
// Notifications and announcements
r.get('/notifications',protect,asyncHandler(async(req,res)=>{const filter={recipient:req.user._id};if(req.query.unread==='true')filter.isRead=false;const items=await Notification.find(filter).populate('event','title').sort('-createdAt').limit(Math.min(100,+req.query.limit||20));const unread=await Notification.countDocuments({recipient:req.user._id,isRead:false});res.json({success:true,items,unread});}));
r.put('/notifications/read-all',protect,asyncHandler(async(req,res)=>{await Notification.updateMany({recipient:req.user._id,isRead:false},{$set:{isRead:true,readAt:new Date()}});res.json({success:true});}));
r.put('/notifications/:id/read',protect,asyncHandler(async(req,res)=>{const n=await Notification.findOneAndUpdate({_id:req.params.id,recipient:req.user._id},{$set:{isRead:true,readAt:new Date()}},{new:true});if(!n)return fail(res,404,'Notification not found');res.json({success:true,notification:n});}));
r.delete('/notifications/:id',protect,asyncHandler(async(req,res)=>{const n=await Notification.findOneAndDelete({_id:req.params.id,recipient:req.user._id,isAnnouncement:false});if(!n)return fail(res,404,'Notification not found or cannot be deleted');res.json({success:true});}));
r.post('/announcements',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const {title,message,audience='all',urgent=false}=req.body;if(!title||!message)return fail(res,422,'Title and message are required.');const roles=audience==='all'?['student','faculty','club','admin']:[audience];const users=await User.find({role:{$in:roles},isActive:true,...(urgent?{}:{'notificationPreferences.announcements':{$ne:false}})}).select('_id');await Notification.insertMany(users.map(u=>({recipient:u._id,title,message,type:'announcement',isAnnouncement:true,urgent,createdBy:req.user._id})));await audit(req.user._id,'announcement','Notification',null,{title,audience,count:users.length});res.status(201).json({success:true,recipients:users.length});}));
// Profile and reports
r.get('/profile',protect,asyncHandler(async(req,res)=>res.json({success:true,user:req.user})));
r.put('/profile',protect,asyncHandler(async(req,res)=>{
  const u=await User.findById(req.user._id);
  for(const k of ['name','phone','bio','department','year'])if(req.body[k]!==undefined)u[k]=req.body[k];
  if(req.body.notificationPreferences)for(const k of ['reminders','updates','announcements'])if(typeof req.body.notificationPreferences[k]==='boolean')u.set(`notificationPreferences.${k}`,req.body.notificationPreferences[k]);
  await u.save();
  res.json({success:true,user:{...safe(u),role:req.user.role,roles:req.user.roles}});
}));
r.put('/profile/password',protect,asyncHandler(async(req,res)=>{const u=await User.findById(req.user._id);if(!await comparePassword(req.body.currentPassword||'',u.passwordHash))return fail(res,400,'The current password is incorrect.');if(req.body.newPassword!==req.body.confirmPassword)return fail(res,422,'The passwords entered do not match.');if(!PW_RE.test(req.body.newPassword||''))return fail(res,422,'Password must be 8–20 characters with upper-case, lower-case, a digit and a special character.');u.passwordHash=await hashPassword(req.body.newPassword);await u.save();res.json({success:true,message:'Password updated.'});}));
const buildReport=async req=>{
  const match={};
  if(req.user.role!=='admin')match.organizer=req.user._id;
  if(req.query.from||req.query.to)match.startAt={...(req.query.from?{$gte:new Date(req.query.from)}:{}),...(req.query.to?{$lte:new Date(req.query.to)}:{})};
  if(req.query.category)match.category=req.query.category;
  const events=await Event.find(match).populate('category','name').populate('organizer','name').lean();
  const regs=await Registration.find({event:{$in:events.map(e=>e._id)}}).lean();
  const count=(arr,f)=>Object.entries(arr.reduce((a,x)=>{const k=f(x);a[k]=(a[k]||0)+1;return a;},{})).map(([name,value])=>({name,value}));
  const attended=regs.filter(x=>x.status==='Attended').length;
  const marked=regs.filter(x=>['Attended','Not attended'].includes(x.status)).length;
  const perEvent=events.map(e=>{const rs=regs.filter(x=>String(x.event)===String(e._id));return{title:e.title,status:e.status,startAt:e.startAt,capacity:e.capacity,registeredCount:e.registeredCount,waitlisted:rs.filter(x=>x.status==='Waitlisted').length,attended:rs.filter(x=>x.status==='Attended').length,absent:rs.filter(x=>x.status==='Not attended').length,fillRate:e.capacity?Math.round(e.registeredCount/e.capacity*100):0,organizer:e.organizer?.name||'—'};});
  const orgMap={};for(const e of perEvent){const o=orgMap[e.organizer]||(orgMap[e.organizer]={name:e.organizer,events:0,registrations:0});o.events++;o.registrations+=e.registeredCount||0;}
  return{
    summary:{events:events.length,registrations:regs.length,completed:events.filter(e=>['Completed','Archived'].includes(e.status)).length,attendanceRate:marked?Math.round(attended/marked*100):0},
    byStatus:count(events,e=>e.status),
    byCategory:count(events,e=>e.category?.name||'Other'),
    registrationsByStatus:count(regs,x=>x.status),
    trend:count(events,e=>new Date(e.startAt).toISOString().slice(0,7)).sort((a,b)=>a.name.localeCompare(b.name)),
    organizers:Object.values(orgMap).sort((a,b)=>b.registrations-a.registrations),
    events:perEvent
  };
};
r.get('/reports/:type',protect,allowRoles('faculty','club','admin'),asyncHandler(async(req,res)=>res.json({success:true,report:req.params.type,data:await buildReport(req)})));
r.get('/reports/:type/export',protect,allowRoles('faculty','club','admin'),asyncHandler(async(req,res)=>{
  const d=await buildReport(req);
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const rows=[['Event','Status','Date','Capacity','Registered','Waitlisted','Attended','Absent','Fill rate %','Organizer'],...d.events.map(e=>[e.title,e.status,new Date(e.startAt).toISOString().slice(0,10),e.capacity,e.registeredCount,e.waitlisted,e.attended,e.absent,e.fillRate,e.organizer])];
  res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="unievents-report.csv"');
  res.send(rows.map(x=>x.map(q).join(',')).join('\n'));
}));
r.get('/admin/overview',protect,allowRoles('admin'),asyncHandler(async(req,res)=>{const [users,events,pending,registrations,completed]=await Promise.all([User.countDocuments({isActive:true}),Event.countDocuments(),Event.countDocuments({status:'Pending'}),Registration.countDocuments({status:{$in:['Confirmed','Attended','Not attended']}}),Event.countDocuments({status:{$in:['Completed','Archived']}})]);res.json({success:true,stats:{users,events,pending,registrations,completed},recent:await Event.find().populate('organizer','name').sort('-createdAt').limit(8)});}));
r.get('/admin/audit',protect,allowRoles('admin'),asyncHandler(async(req,res)=>res.json({success:true,items:await AuditLog.find().populate('user','name email').sort('-createdAt').limit(100)})));
export default r;
