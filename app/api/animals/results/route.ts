import { ROUND_CONFIGS, type DailyDifficulty } from "../../../../lib/gameRules";
import { publishedAnimalTraitIds } from "../../../../lib/animalstatsCoverage";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { animalPreviewEnabled } from "../../../../lib/animalstatsPreview";
import { createSupabaseServerClient, createSupabaseAdminClient } from "../../../../lib/supabase/server";
import { scoreAnimalAssignments } from "../../../../lib/animalstatsScoring";
import { approvedAnimalBoards, animalBoardDataFingerprint, type AnimalBoardReview } from "../../../../lib/animalstatsReview";
import { orderAnimalPilotBoards } from "../../../../lib/animalstatsDaily";
import { readAllPages } from "../../../../lib/pagedRead";
import { newYorkDate } from "../../../../lib/time";
import type { AnimalDataset, BoardCandidate } from "../../../../lib/animalstats";
import dataset from "../../../../data/animalstats/pilot.json";
import candidates from "../../../../data/animalstats/candidates.json";
import reviewManifest from "../../../../data/animalstats/reviews.json";
const data = dataset as AnimalDataset;
const published = publishedAnimalTraitIds(data);
const boards = (candidates.boards as BoardCandidate[]).filter(b => b.traitIds.every(id => published.has(id)));
const headers = { "Cache-Control": "private, no-store" };
const columns = "game_id,board_id,challenge_date,difficulty,play_kind,score,optimal_choices,average_placement,ranks,completed_at";
type StoredResult = { game_id:string;board_id:string;challenge_date:string;difficulty:string;play_kind:string;score:number;optimal_choices:number;average_placement:number;ranks:number[];completed_at:string };
function result(row: StoredResult) { return { id:row.game_id,boardId:row.board_id,date:row.challenge_date,mode:row.difficulty,kind:row.play_kind,score:ROUND_CONFIGS[row.difficulty as DailyDifficulty].pointsByRank.reduce((sum, points, index) => sum + points * row.ranks.filter(rank => rank === index + 1).length, 0),optimalChoices:row.optimal_choices,averagePlacement:Number(row.average_placement),ranks:row.ranks,completedAt:row.completed_at }; }
export async function GET() {
 if (!animalPreviewEnabled()) return new NextResponse("Not found", { status:404 });
 const client = await createSupabaseServerClient();
 if (!client) return NextResponse.json({ signedIn:false }, { headers });
 const { data:{user}, error:authError } = await client.auth.getUser();
 if (authError || !user) return NextResponse.json({ signedIn:false }, { headers });
 const { data:rows, error } = await readAllPages((from, to) => client.from("animal_game_results").select(columns).eq("user_id",user.id).in("rules_version",["animalstats-v1","animalstats-v2-nonlinear"]).order("challenge_date",{ascending:false}).order("completed_at",{ascending:false}).range(from,to));
 if (error) return NextResponse.json({ signedIn:true,error:"Account history is temporarily unavailable." }, { status:503,headers });
 return NextResponse.json({ signedIn:true,results:(rows ?? []).map((row) => result(row as StoredResult)) }, { headers });
}
export async function POST(request: Request) {
 if (!animalPreviewEnabled()) return new NextResponse("Not found", { status:404 });
 const origin=request.headers.get("origin");
 if (origin && origin!==new URL(request.url).origin) return NextResponse.json({error:"Invalid origin."},{status:403,headers});
 const client=await createSupabaseServerClient();const admin=createSupabaseAdminClient();
 if (!client || !admin) return NextResponse.json({error:"Account saving is unavailable."},{status:503,headers});
 const {data:{user},error:authError}=await client.auth.getUser();
 if (authError || !user) return NextResponse.json({error:"Sign in to save account results."},{status:401,headers});
 let body: {boardId?:unknown;kind?:unknown;assignments?:unknown};
 try { const raw=await request.text();if(raw.length>20000)throw Error("size");body=JSON.parse(raw);if(!body || typeof body!=="object")throw Error("body"); } catch { return NextResponse.json({error:"Invalid submission."},{status:400,headers}); }
 const board=boards.find((row)=>row.id===body.boardId);
 if (!board || (body.kind!=="daily" && body.kind!=="random")) return NextResponse.json({error:"Invalid board."},{status:400,headers});
 const date=newYorkDate();
 if (body.kind==="daily") {
  const daily=orderAnimalPilotBoards(approvedAnimalBoards(data,boards,reviewManifest as AnimalBoardReview[]),date,data).filter((row)=>row.mode===board.mode).slice(0,1);
  if(!daily.some((row)=>row.id===board.id))return NextResponse.json({error:"This board is not an approved daily."},{status:400,headers});
 }
 const scored=scoreAnimalAssignments(data,board,body.assignments);
 if(!scored)return NextResponse.json({error:"Complete the board with valid, unique animals."},{status:400,headers});
 const id=`${body.kind}:${date}:${board.id}`;
 const entry={user_id:user.id,game_id:id,board_id:board.id,challenge_date:date,difficulty:board.mode,play_kind:body.kind,score:scored.score,optimal_choices:scored.optimalChoices,average_placement:scored.averagePlacement,ranks:scored.ranks,assignments:body.assignments,dataset_fingerprint:createHash("sha256").update(animalBoardDataFingerprint(data,board)).digest("hex"),rules_version:"animalstats-v2-nonlinear"};
 const {error}=await admin.from("animal_game_results").upsert(entry,{onConflict:"user_id,game_id",ignoreDuplicates:true});
 if(error)return NextResponse.json({error:"Your account result could not be saved."},{status:503,headers});
 const {data:saved,error:readError}=await client.from("animal_game_results").select(columns).eq("user_id",user.id).eq("game_id",id).single();
 if(readError || !saved)return NextResponse.json({error:"Your saved result could not be loaded."},{status:503,headers});
 return NextResponse.json({result:result(saved as StoredResult)}, {headers});
}
