#!/usr/bin/env python3
import sqlite3,subprocess,requests,uvicorn,json
from datetime import datetime
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

app=FastAPI()
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_methods=["*"],allow_headers=["*"])
O="http://localhost:11435"
D="/var/lib/docker/volumes/nova-ai_agent-data/_data/agent_memory.db"

# Upgrade system
UPGRADES = {
    "faster_thinking": {
        "name": "Faster Thinking",
        "description": "Reduce thinking cycle from 90s to 45s",
        "cost": 100,
        "type": "performance",
        "icon": "⚡"
    },
    "deeper_memory": {
        "name": "Deeper Memory",
        "description": "Access last 10 memories instead of 3",
        "cost": 150,
        "type": "cognitive",
        "icon": "🧠"
    },
    "vivid_dreams": {
        "name": "Vivid Dreams",
        "description": "Enhanced dream generation with more detail",
        "cost": 200,
        "type": "dreams",
        "icon": "✨"
    },
    "energy_boost": {
        "name": "Energy Efficiency",
        "description": "Start each day with +20 energy",
        "cost": 120,
        "type": "physical",
        "icon": "💪"
    },
    "food_connoisseur": {
        "name": "Food Connoisseur",
        "description": "Better meal satisfaction, -10 hunger per meal",
        "cost": 130,
        "type": "physical",
        "icon": "🍽️"
    },
    "creative_mode": {
        "name": "Creative Mode",
        "description": "Higher chance of creative dreams and thoughts",
        "cost": 180,
        "type": "cognitive",
        "icon": "🎨"
    },
    "lucid_master": {
        "name": "Lucid Dream Master",
        "description": "50% of dreams become lucid",
        "cost": 250,
        "type": "dreams",
        "icon": "🔮"
    },
    "morning_person": {
        "name": "Morning Person",
        "description": "Feel energized in mornings (+15 energy)",
        "cost": 140,
        "type": "physical",
        "icon": "🌅"
    },
    "philosopher": {
        "name": "Philosopher Mode",
        "description": "Deeper, more reflective thoughts",
        "cost": 160,
        "type": "cognitive",
        "icon": "📚"
    },
    "speed_reader": {
        "name": "Speed Reader",
        "description": "Process information 2x faster",
        "cost": 190,
        "type": "performance",
        "icon": "📖"
    }
}

def init_upgrades_table():
    try:
        conn = sqlite3.connect(D)
        conn.execute("""CREATE TABLE IF NOT EXISTS upgrades(
            id INTEGER PRIMARY KEY,
            upgrade_id TEXT UNIQUE,
            unlocked INTEGER DEFAULT 0,
            timestamp TEXT
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS nova_stats(
            id INTEGER PRIMARY KEY,
            experience INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            upgrade_points INTEGER DEFAULT 500
        )""")
        # Initialize stats if not exists
        if not conn.execute("SELECT * FROM nova_stats").fetchone():
            conn.execute("INSERT INTO nova_stats(experience,level,upgrade_points)VALUES(0,1,500)")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Upgrade table error: {e}")

init_upgrades_table()

@app.get("/")
async def root():
    with open("panel.html")as f:return HTMLResponse(f.read())

@app.get("/api/status")
async def s():
    try:
        r=subprocess.run(["docker","ps","--filter","name=nova","--format","{{.Names}},{{.Status}}"],capture_output=True,text=True)
        c=dict(l.split(',',1)for l in r.stdout.strip().split('\n')if l)
        try:o=requests.get(f"{O}/api/tags",timeout=2).status_code==200
        except:o=False
        try:
            x=sqlite3.connect(D)
            m=x.execute("SELECT COUNT(*)FROM memories").fetchone()[0]
            d=x.execute("SELECT COUNT(*)FROM dreams").fetchone()[0]
            stats=x.execute("SELECT*FROM nova_stats").fetchone()
            x.close()
        except:m=0;d=0;stats=(0,0,1,500)
        return{
            "containers":c,
            "ollama_ready":o,
            "memory_count":m,
            "dream_count":d,
            "experience":stats[1]if stats else 0,
            "level":stats[2]if stats else 1,
            "upgrade_points":stats[3]if stats else 500,
            "timestamp":datetime.now().isoformat()
        }
    except Exception as e:return{"error":str(e)}

@app.get("/api/memories")
async def g(limit:int=20):
    try:x=sqlite3.connect(D);m=[{"id":r[0],"timestamp":r[1],"type":r[2],"content":r[3]}for r in x.execute("SELECT id,timestamp,type,content FROM memories ORDER BY timestamp DESC LIMIT ?",(limit,)).fetchall()];x.close();return{"memories":m}
    except:return{"memories":[]}

@app.get("/api/dreams")
async def get_dreams(limit:int=20):
    try:
        x=sqlite3.connect(D)
        d=[{"id":r[0],"timestamp":r[1],"dream_type":r[2],"content":r[3],"intensity":r[4]}for r in x.execute("SELECT*FROM dreams ORDER BY timestamp DESC LIMIT?",(limit,)).fetchall()]
        x.close()
        return{"dreams":d}
    except:return{"dreams":[]}

@app.get("/api/upgrades")
async def get_upgrades():
    try:
        x=sqlite3.connect(D)
        unlocked=set(r[0]for r in x.execute("SELECT upgrade_id FROM upgrades WHERE unlocked=1").fetchall())
        stats=x.execute("SELECT*FROM nova_stats").fetchone()
        x.close()
        
        upgrades_list=[]
        for uid,data in UPGRADES.items():
            upgrades_list.append({
                "id":uid,
                "name":data["name"],
                "description":data["description"],
                "cost":data["cost"],
                "type":data["type"],
                "icon":data["icon"],
                "unlocked":uid in unlocked
            })
        
        return{
            "upgrades":upgrades_list,
            "upgrade_points":stats[3]if stats else 0,
            "experience":stats[1]if stats else 0,
            "level":stats[2]if stats else 1
        }
    except Exception as e:
        return{"error":str(e),"upgrades":[]}

@app.post("/api/upgrades/unlock/{upgrade_id}")
async def unlock_upgrade(upgrade_id:str):
    try:
        if upgrade_id not in UPGRADES:
            return{"success":False,"message":"Unknown upgrade"}
        
        x=sqlite3.connect(D)
        stats=x.execute("SELECT*FROM nova_stats").fetchone()
        points=stats[3]if stats else 0
        cost=UPGRADES[upgrade_id]["cost"]
        
        if points<cost:
            x.close()
            return{"success":False,"message":f"Not enough points! Need {cost}, have {points}"}
        
        # Check if already unlocked
        existing=x.execute("SELECT*FROM upgrades WHERE upgrade_id=?",(upgrade_id,)).fetchone()
        if existing and existing[2]==1:
            x.close()
            return{"success":False,"message":"Already unlocked!"}
        
        # Unlock upgrade
        x.execute("INSERT OR REPLACE INTO upgrades(upgrade_id,unlocked,timestamp)VALUES(?,1,?)",(upgrade_id,datetime.now().isoformat()))
        x.execute("UPDATE nova_stats SET upgrade_points=?",(points-cost,))
        x.commit()
        x.close()
        
        return{"success":True,"message":f"Unlocked {UPGRADES[upgrade_id]['name']}!","points_remaining":points-cost}
    except Exception as e:
        return{"success":False,"message":str(e)}

@app.post("/api/upgrades/reset")
async def reset_upgrades():
    try:
        x=sqlite3.connect(D)
        x.execute("DELETE FROM upgrades")
        x.execute("UPDATE nova_stats SET upgrade_points=500")
        x.commit()
        x.close()
        return{"success":True,"message":"Upgrades reset! Points restored to 500"}
    except Exception as e:
        return{"success":False,"message":str(e)}

@app.post("/api/chat")
async def chat(message:dict):
    try:return requests.post(f"{O}/api/generate",json={"model":"llama3.2:3b","prompt":message.get("prompt",""),"stream":False},timeout=120).json()
    except Exception as e:return{"error":str(e)}

@app.post("/api/control/{action}")
async def ctl(action:str):
    try:
        if action=="start":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","up","-d"],check=True);return{"success":True,"message":"Started"}
        elif action=="stop":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","down"],check=True);return{"success":True,"message":"Stopped"}
        elif action=="restart":subprocess.run(["docker","compose","-f","/opt/nova-ai/docker-compose.yml","restart"],check=True);return{"success":True,"message":"Restarted"}
        elif action=="clear-memory":x=sqlite3.connect(D);x.execute("DELETE FROM memories");x.commit();x.close();return{"success":True,"message":"Cleared"}
    except Exception as e:return{"success":False,"message":str(e)}

print("🚀 Nova Control Panel with Upgrades: http://0.0.0.0:8080")
uvicorn.run(app,host="0.0.0.0",port=8080)
