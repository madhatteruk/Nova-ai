#!/usr/bin/env python3
"""Nova MEGA API - Complete Control System"""
import sqlite3,subprocess,requests,uvicorn,os,json,base64
from datetime import datetime
from fastapi import FastAPI,UploadFile,File
from fastapi.responses import HTMLResponse,FileResponse,JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app=FastAPI()
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
O="http://localhost:11435"
D="/var/lib/docker/volumes/nova-ai_agent-data/_data/agent_memory.db"

class PersonalityUpdate(BaseModel):
    trait:str;value:int
class GoalCreate(BaseModel):
    goal:str
class ContentRequest(BaseModel):
    type:str;topic:str;params:dict={}
class SocialPost(BaseModel):
    platform:str;content:str
class ImageRequest(BaseModel):
    prompt:str;style:str="photorealistic"
class AppRequest(BaseModel):
    description:str;app_type:str="react"

def init_tables():
    try:
        c=sqlite3.connect(D)
        c.execute("CREATE TABLE IF NOT EXISTS code_upgrades(id INTEGER PRIMARY KEY,timestamp TEXT,module_name TEXT,code TEXT,status TEXT,description TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS personality(id INTEGER PRIMARY KEY,trait TEXT UNIQUE,value INTEGER,description TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY,timestamp TEXT,goal TEXT,status TEXT,progress INTEGER)")
        c.execute("CREATE TABLE IF NOT EXISTS created_content(id INTEGER PRIMARY KEY,timestamp TEXT,content_type TEXT,title TEXT,path TEXT,metadata TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS social_posts(id INTEGER PRIMARY KEY,timestamp TEXT,platform TEXT,content TEXT,status TEXT,post_id TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS training_examples(id INTEGER PRIMARY KEY,timestamp TEXT,input TEXT,output TEXT,category TEXT)")
        c.execute("INSERT OR IGNORE INTO personality(trait,value,description)VALUES('creativity',70,'Creative thinking'),('humor',50,'Sense of humor'),('formality',40,'Professional tone'),('curiosity',80,'Learning drive'),('empathy',60,'Emotional understanding')")
        c.commit();c.close()
    except Exception as e:print(f"Init error: {e}")

init_tables()

@app.get("/")
async def root():
    with open("panel.html")as f:return HTMLResponse(f.read())

@app.get("/api/status")
async def status():
    try:
        r=subprocess.run(["docker","ps","--filter","name=nova","--format","{{.Names}},{{.Status}}"],capture_output=True,text=True)
        containers=dict(l.split(',',1)for l in r.stdout.strip().split('\n')if l)
        ollama_ready=False
        try:ollama_ready=requests.get(f"{O}/api/tags",timeout=2).status_code==200
        except:pass
        x=sqlite3.connect(D)
        m=x.execute("SELECT COUNT(*)FROM memories").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='memories'").fetchone()else 0
        d=x.execute("SELECT COUNT(*)FROM dreams").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='dreams'").fetchone()else 0
        cu=x.execute("SELECT COUNT(*)FROM code_upgrades").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='code_upgrades'").fetchone()else 0
        cc=x.execute("SELECT COUNT(*)FROM created_content").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='created_content'").fetchone()else 0
        sp=x.execute("SELECT COUNT(*)FROM social_posts").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='social_posts'").fetchone()else 0
        goals=x.execute("SELECT COUNT(*)FROM goals WHERE status!='completed'").fetchone()[0]if x.execute("SELECT name FROM sqlite_master WHERE type='table'AND name='goals'").fetchone()else 0
        x.close()
        return{"containers":containers,"ollama_ready":ollama_ready,"memory_count":m,"dream_count":d,"code_upgrades_count":cu,"content_count":cc,"social_posts_count":sp,"active_goals":goals,"timestamp":datetime.now().isoformat()}
    except Exception as e:return{"error":str(e)}

# MEMORIES & THOUGHTS
@app.get("/api/memories")
async def get_memories(limit:int=20):
    try:x=sqlite3.connect(D);m=[{"id":r[0],"timestamp":r[1],"type":r[2],"content":r[3]}for r in x.execute("SELECT*FROM memories ORDER BY timestamp DESC LIMIT?",(limit,)).fetchall()];x.close();return{"memories":m}
    except:return{"memories":[]}

@app.get("/api/dreams")
async def get_dreams(limit:int=20):
    try:x=sqlite3.connect(D);d=[{"id":r[0],"timestamp":r[1],"dream_type":r[2],"content":r[3],"intensity":r[4]}for r in x.execute("SELECT*FROM dreams ORDER BY timestamp DESC LIMIT?",(limit,)).fetchall()];x.close();return{"dreams":d}
    except:return{"dreams":[]}

# CODE UPGRADES
@app.get("/api/code-upgrades")
async def get_code_upgrades():
    try:x=sqlite3.connect(D);u=[{"id":r[0],"timestamp":r[1],"module_name":r[2],"code":r[3],"status":r[4],"description":r[5]}for r in x.execute("SELECT*FROM code_upgrades ORDER BY timestamp DESC").fetchall()];x.close();return{"upgrades":u}
    except:return{"upgrades":[]}

@app.post("/api/code-upgrades/approve/{id}")
async def approve_upgrade(id:int):
    try:x=sqlite3.connect(D);x.execute("UPDATE code_upgrades SET status='active'WHERE id=?",(id,));x.commit();x.close();return{"success":True,"message":"Activated!"}
    except Exception as e:return{"success":False,"message":str(e)}

@app.post("/api/code-upgrades/reject/{id}")
async def reject_upgrade(id:int):
    try:x=sqlite3.connect(D);x.execute("UPDATE code_upgrades SET status='rejected'WHERE id=?",(id,));x.commit();x.close();return{"success":True}
    except:return{"success":False}

# PERSONALITY SYSTEM
@app.get("/api/personality")
async def get_personality():
    try:x=sqlite3.connect(D);p=[{"trait":r[1],"value":r[2],"description":r[3]}for r in x.execute("SELECT*FROM personality").fetchall()];x.close();return{"personality":p}
    except:return{"personality":[]}

@app.post("/api/personality/update")
async def update_personality(update:PersonalityUpdate):
    try:x=sqlite3.connect(D);x.execute("UPDATE personality SET value=?WHERE trait=?",(update.value,update.trait));x.commit();x.close();return{"success":True}
    except:return{"success":False}

# GOALS SYSTEM
@app.get("/api/goals")
async def get_goals():
    try:x=sqlite3.connect(D);g=[{"id":r[0],"timestamp":r[1],"goal":r[2],"status":r[3],"progress":r[4]}for r in x.execute("SELECT*FROM goals ORDER BY timestamp DESC").fetchall()];x.close();return{"goals":g}
    except:return{"goals":[]}

@app.post("/api/goals/create")
async def create_goal(goal:GoalCreate):
    try:x=sqlite3.connect(D);x.execute("INSERT INTO goals(timestamp,goal,status,progress)VALUES(?,?,?,?)",(datetime.now().isoformat(),goal.goal,"active",0));x.commit();x.close();return{"success":True}
    except:return{"success":False}

# CONTENT CREATION
@app.get("/api/content")
async def get_content(limit:int=20):
    try:x=sqlite3.connect(D);c=[{"id":r[0],"timestamp":r[1],"type":r[2],"title":r[3],"path":r[4]}for r in x.execute("SELECT*FROM created_content ORDER BY timestamp DESC LIMIT?",(limit,)).fetchall()];x.close();return{"content":c}
    except:return{"content":[]}

@app.post("/api/content/create")
async def create_content(req:ContentRequest):
    try:
        result=f"Created {req.type} about {req.topic}"
        x=sqlite3.connect(D);x.execute("INSERT INTO created_content(timestamp,content_type,title,path,metadata)VALUES(?,?,?,?,?)",(datetime.now().isoformat(),req.type,req.topic,f"data/content/{req.type}_{int(datetime.now().timestamp())}.txt",json.dumps(req.params)));x.commit();x.close()
        return{"success":True,"result":result}
    except:return{"success":False}

# IMAGE GENERATION
@app.post("/api/image/generate")
async def generate_image(req:ImageRequest):
    try:
        # Placeholder - would integrate with actual image gen API
        result=f"Generated image: {req.prompt} in {req.style} style"
        return{"success":True,"image_url":f"/data/images/img_{int(datetime.now().timestamp())}.png","message":result}
    except:return{"success":False}

# APP BUILDER
@app.post("/api/app/build")
async def build_app(req:AppRequest):
    try:
        result=f"Built {req.app_type} app: {req.description}"
        filepath=f"/data/apps/app_{int(datetime.now().timestamp())}.html"
        return{"success":True,"app_url":filepath,"message":result}
    except:return{"success":False}

# SOCIAL MEDIA
@app.get("/api/social/posts")
async def get_social_posts():
    try:x=sqlite3.connect(D);p=[{"id":r[0],"timestamp":r[1],"platform":r[2],"content":r[3],"status":r[4]}for r in x.execute("SELECT*FROM social_posts ORDER BY timestamp DESC").fetchall()];x.close();return{"posts":p}
    except:return{"posts":[]}

@app.post("/api/social/post")
async def create_social_post(post:SocialPost):
    try:x=sqlite3.connect(D);x.execute("INSERT INTO social_posts(timestamp,platform,content,status)VALUES(?,?,?,?)",(datetime.now().isoformat(),post.platform,post.content,"pending"));x.commit();x.close();return{"success":True}
    except:return{"success":False}

# ANDROID VM
@app.get("/api/android/status")
async def android_status():
    try:result=os.popen("adb devices").read();connected="emulator"in result or"device"in result;return{"connected":connected,"output":result}
    except:return{"connected":False}

@app.post("/api/android/command")
async def android_command(cmd:dict):
    try:result=os.popen(f"adb shell {cmd.get('command','')}").read();return{"success":True,"output":result}
    except Exception as e:return{"success":False,"output":str(e)}

@app.get("/api/android/screenshot")
async def android_screenshot():
    try:os.popen("adb shell screencap -p /sdcard/screen.png").read();os.popen("adb pull /sdcard/screen.png /tmp/android_screen.png").read();return FileResponse("/tmp/android_screen.png",media_type="image/png")
    except:return{"error":"Failed"}

@app.post("/api/android/tap")
async def android_tap(coords:dict):
    try:result=os.popen(f"adb shell input tap {coords.get('x',0)} {coords.get('y',0)}").read();return{"success":True}
    except:return{"success":False}

@app.post("/api/android/swipe")
async def android_swipe(params:dict):
    try:result=os.popen(f"adb shell input swipe {params.get('x1',0)} {params.get('y1',0)} {params.get('x2',0)} {params.get('y2',0)}").read();return{"success":True}
    except:return{"success":False}

# TRAINING SYSTEM
@app.get("/api/training/examples")
async def get_training():
    try:x=sqlite3.connect(D);t=[{"id":r[0],"input":r[2],"output":r[3],"category":r[4]}for r in x.execute("SELECT*FROM training_examples ORDER BY timestamp DESC LIMIT 50").fetchall()];x.close();return{"examples":t}
    except:return{"examples":[]}

@app.post("/api/training/add")
async def add_training(example:dict):
    try:x=sqlite3.connect(D);x.execute("INSERT INTO training_examples(timestamp,input,output,category)VALUES(?,?,?,?)",(datetime.now().isoformat(),example.get('input',''),example.get('output',''),example.get('category','general')));x.commit();x.close();return{"success":True}
    except:return{"success":False}

# FILE MANAGEMENT
@app.get("/api/files/list")
async def list_files(path:str="data"):
    try:
        files=[]
        for root,dirs,filenames in os.walk(path):
            for f in filenames:files.append({"name":f,"path":os.path.join(root,f),"size":os.path.getsize(os.path.join(root,f))})
        return{"files":files[:100]}
    except:return{"files":[]}

# CHAT
@app.post("/api/chat")
async def chat(message:dict):
    try:return requests.post(f"{O}/api/generate",json={"model":"llama3.2:3b","prompt":message.get("prompt",""),"stream":False},timeout=120).json()
    except Exception as e:return{"error":str(e)}

# CONTROL
@app.post("/api/control/{action}")
async def control(action:str):
    try:
        if action=="start":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","up","-d"],check=True);return{"success":True,"message":"Started"}
        elif action=="stop":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","down"],check=True);return{"success":True,"message":"Stopped"}
        elif action=="restart":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","restart"],check=True);return{"success":True,"message":"Restarted"}
        elif action=="clear-memory":x=sqlite3.connect(D);x.execute("DELETE FROM memories");x.commit();x.close();return{"success":True,"message":"Cleared"}
    except Exception as e:return{"success":False,"message":str(e)}

print("🚀 Nova MEGA Control Panel: http://0.0.0.0:8080")
uvicorn.run(app,host="0.0.0.0",port=8080)
