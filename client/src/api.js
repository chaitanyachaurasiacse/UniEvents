import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:5000/api'});
api.interceptors.request.use(c=>{const t=sessionStorage.getItem('unievents_token');if(t)c.headers.Authorization=`Bearer ${t}`;const r=sessionStorage.getItem('unievents_role');if(r)c.headers['X-Active-Role']=r;return c;});
api.interceptors.response.use(r=>r.data,e=>{
  const err=e.response?.data?.error;
  let msg=err?.message||e.message||'Something went wrong';
  if(!e.response)msg='Cannot reach the server. Check your connection and try again.';
  if(Array.isArray(err?.details)&&err.details.length)msg+=' ('+[...new Set(err.details.map(d=>d.path))].join(', ')+')';
  if(e.response?.status===401&&err?.code==='SESSION_EXPIRED'&&sessionStorage.getItem('unievents_token')){sessionStorage.removeItem('unievents_token');sessionStorage.removeItem('unievents_role');window.location.href='/';}
  return Promise.reject(new Error(msg));
});
