import { NextResponse } from 'next/server';
import { getAriaSandbox } from '@/lib/aria2';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const queries = [
"SHY FX Maverick Sabre Call Me official",
"BCee Philippa Hanna Back to the Street official",
"DJ Patife Sambassim DJ Patife Remix",
"Drumagick João Sobral Brazilian D&B Vocal Extended Mix",
"Zeca Pagodinho Deixa A Vida Me Levar official",
"Hybrid Minds Riya Kismet",
"Skool Of Thought Ed Solo Life Gets Better",
"SpectraSoul Tamara Blessa Away With Me Calibre Remix",
"DJ Marky XRS Stamina MC LK original",
"Hybrid Minds Catching Cairo Touch",
"Davido Fall official video",
"Rema Dumebi official video",
"Santana Oye Como Va official audio",
"StarBoy Wizkid Ceeza Milli Spotless Terri Soco official video",
"Villem Mcleod Leo Woods Let It Breathe",
"Break Celestine Last Goodbye",
"High Contrast Love On A 45",
"Benny Page Eva Lazarus Front Left",
"DJ Marky Silly original mix",
"Naâman Cutty Ranks Rebel for Life",
"Chaka Demus Pliers Jack Radics Twist And Shout official",
"LSB Kinross Roots",
"The Mouse Outfit Lenzman IAMDDB KinKai Feeling High Lenzman Remix",
"Congo Natty Peter Bouncer Junglist",
"Melé Shovell Pasilda",
"Serial Killaz Jamaican Boy",
"Chase & Status IRAH Program",
"Villem Mcleod Leo Wood Let It Breathe",
"Lenzman Ever so Slightly",
"Jay Prince In The Morning",
"Wizkid Bucie All For Love",
"FooR Effie 3 Words",
"Black Coffee Mque Come With Me",
"B Young 079ME",
"Serial Killaz Cornell Campbell Mash You Down",
"Chase & Status Kabaka Pyramid Ms Dynamite SHY FX Murder Music SHY FX Remix",
"Zar Motiv Diligent Fingers Sahala Your Power",
"Sauti Sol Suzanna official video",
"Netsky Daddy Waku Chantal Kashala Everybody Loves The Sunshine",
"Bad Bunny Yonaguni official video",
"Roberto Roena Y Su Apollo Sound Que Se Sepa",
"SHY FX T Power Di Unavailable",
"Ralf Gum Monique Bingham Claudette Ralf Gum Radio Edit",
"Hyenah DJ Tira Luke Ntombela Ezizweni",
"SahBabii T3 Sunny Days",
"Nia Archives Sober Feels",
"Fania All Stars Ella Fue She Was The One",
"Nymfo Crystal Clear",
"Dr Meaker GOLD Dubs Jman Born Inna Babylon",
"Eladio Carrion Rels B Me Gustas Natural",
"The Bongo Hop Nidia Gongora Tite jeanne",
"Wilkinson Becky Hill Here For You",
"goddard Prospa",
"Micro TDH Cumpliendo el Objetivo",
"Drake Rihanna Take Care official video",
"Cat Burns goddard go goddard Remix",
"TZ Edlan Strictly Lone",
"Eladio Carrion Nicki Nicole Nota",
"Bad Bunny Tití Me Preguntó official video",
"Nia Archives Headz Gone West",
"Quevedo Ovy On The Drums SIN SEÑAL",
"Mentol Brujeria Remix",
"The Martinez Brothers Gordo Rema Rizzla",
"LiTek Abnormal Sleepz Grown & Sexy",
"IAMNOBODI Savior",
"K S R Dogger Sweet Jungle",
"AYLØ Tay Iwar LITT",
"Chi City Saturday Night Lights",
"LF SYSTEM Afraid To Feel official",
"Central Cee Doja official video",
"piri Tommy Villiers on & on official",
"Nia Archives Forbidden Feelingz",
"Chase & Status Pip Millett Over & Done",
"Danny Chaska Hal Shallo Madrid",
"Ciscero Masego Ambriia KP Good To Know",
"phil MaZz with u",
"Illa J Enjoy the Ride",
"Chimbala Feliz official",
"TAKTiX KiD LaZE Moses Cash Flow",
"JAY1 Mercedes official",
"KAHUKX NO BONNIE N CLYDE",
"Koder Richer",
"xryce FUCK IT",
"D38 No Miming",
"Chystemc Macrodee La Pronoia del Sun Joke Fú",
"TheChemist Hello Good Morning",
"Bobby Alu It's Time",
"venbee goddard messy in heaven official",
"DRS Mindstate Émilie Rachel Want You Back",
"Flava D Paige Eliza DRS All We Ever Do",
"The Manor Know What I Mean",
"Piers James Pon Dem",
"Sammy Virji Find My Way Home",
"Aries David Boomah Ain't No Sunshine",
"Mahalia Burna Boy Majestic Simmer Majestic Remix",
"Vibe Chemistry Like That"
];

async function ensureYtDlp(sbx:any){
  const c=await sbx.runCommand({cmd:'bash',args:['-lc',`
    set -e
    if ! command -v yt-dlp >/dev/null 2>&1; then
      curl -L --fail --silent --show-error https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /vercel/sandbox/yt-dlp
      chmod +x /vercel/sandbox/yt-dlp
      ln -sf /vercel/sandbox/yt-dlp /usr/local/bin/yt-dlp 2>/dev/null || true
    fi
    command -v python3 >/dev/null 2>&1
  `],sudo:true});
  if(c.exitCode!==0) throw new Error((await c.stderr())||'resolver bootstrap failed');
}

export async function GET() {
  try {
    const sbx=await getAriaSandbox();
    await ensureYtDlp(sbx);
    const encoded=Buffer.from(JSON.stringify(queries),'utf8').toString('base64');
    const cmd=await sbx.runCommand({cmd:'bash',args:['-lc',`
      set -e
      echo '${encoded}' | base64 -d > /vercel/sandbox/yt_queries.json
      cat > /vercel/sandbox/resolve_yt.py <<'PY'
import json, subprocess, concurrent.futures
queries=json.load(open('/vercel/sandbox/yt_queries.json',encoding='utf-8'))
def one(item):
    i,q=item
    try:
        p=subprocess.run([
            'yt-dlp','--flat-playlist','--no-warnings','--playlist-end','1',
            '--print','%(id)s\\t%(title)s\\t%(channel)s',
            'ytsearch1:'+q
        ],capture_output=True,text=True,timeout=25)
        line=(p.stdout or '').strip().splitlines()
        if p.returncode!=0 or not line:
            return {'i':i,'query':q,'ok':False,'error':(p.stderr or 'No result')[-500:]}
        parts=line[0].split('\\t')
        vid=parts[0] if len(parts)>0 else ''
        return {'i':i,'query':q,'ok':True,'url':'https://www.youtube.com/watch?v='+vid,'title':parts[1] if len(parts)>1 else '','channel':parts[2] if len(parts)>2 else ''}
    except Exception as e:
        return {'i':i,'query':q,'ok':False,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    results=list(ex.map(one, enumerate(queries,1)))
results.sort(key=lambda x:x['i'])
print(json.dumps(results,ensure_ascii=False))
PY
      python3 /vercel/sandbox/resolve_yt.py
    `]});
    const out=(await cmd.stdout()).trim();
    if(cmd.exitCode!==0) throw new Error((await cmd.stderr())||'resolver failed');
    return NextResponse.json({ok:true,results:JSON.parse(out)},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:500});
  }
}