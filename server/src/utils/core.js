import jwt from 'jsonwebtoken';import bcrypt from 'bcryptjs';import {AuditLog,Notification,User} from '../models/index.js';
export const signToken=(u)=>jwt.sign({id:u._id,role:u.role},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'1d'});
export const hashPassword=(p)=>bcrypt.hash(p,12);export const comparePassword=(p,h)=>bcrypt.compare(p,h);
export const notify=async(recipient,title,message,type='general',event=null,createdBy=null)=>{
  if(!recipient) return;
  const u=await User.findById(recipient).select('notificationPreferences').lean();
  const prefs=u?.notificationPreferences||{};
  const group=type.startsWith('reminder')?'reminders':type==='announcement'?'announcements':'updates';
  if(prefs[group]===false&&type!=='cancellation'&&type!=='approval') return;
  return Notification.create({recipient,title,message,type,event,createdBy});
};
export const audit=async(user,action,targetType,targetId,details={},ip='')=>AuditLog.create({user,action,targetType,targetId,details,ip});
export const fail=(res,status,message,code='ERROR',details)=>res.status(status).json({success:false,error:{code,message,details}});
export const asyncHandler=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
