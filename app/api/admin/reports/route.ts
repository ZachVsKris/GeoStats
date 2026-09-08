import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/supabase/adminAuth";
export async function GET() {
 const auth=await requireAdmin();
 if(!auth.ok) return NextResponse.json({error:auth.error},{status:auth.status});
 const [reports,funnel]=await Promise.all([
  auth.admin.from('player_reports').select('id,created_at,status,kind,message,category_id,challenge_date,difficulty,page_path').order('created_at',{ascending:false}).limit(100),
  auth.admin.from('launch_funnel_v1').select('*').single(),
 ]);
 return NextResponse.json({reports:reports.data??[],reportsError:reports.error ? 'Reports could not be loaded.' : null,funnel:funnel.data,funnelError:funnel.error ? 'Funnel metrics could not be loaded.' : null},{headers:{'Cache-Control':'private, no-store'}});
}
export async function PATCH(request:Request) {
 const auth=await requireAdmin();
 if(!auth.ok) return NextResponse.json({error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>null);
 if(!/^[a-f0-9-]{36}$/i.test(body?.id??'')||!['new','resolved'].includes(body?.status))return NextResponse.json({error:'Invalid update.'},{status:400});
 const result=await auth.admin.from('player_reports').update({status:body.status}).eq('id',body.id).select('id').maybeSingle();
 if(result.error||!result.data)return NextResponse.json({error:'Report could not be updated.'},{status:400});
 return NextResponse.json({saved:true});
}
