
# # A very simple Flask Hello World app for you to get started with...

# from flask import Flask

# app = Flask(__name__)

# @app.route('/')
# def hello_world():
#     return 'Hello from Flask!'

# #

# app.py - Flask后端
from flask import Flask, render_template, request, jsonify, session
import json
import os
from openai import OpenAI

app = Flask(__name__)
app.secret_key = os.urandom(24)  # 用于session加密

# 初始化DeepSeek客户端
client = OpenAI(
    api_key="sk-cf567b2a17ce4cf9ad7ad39789e380f4",
    base_url="https://api.deepseek.com"
)

# 加载题库 - 实际部署时确保路径正确
# 直接在模块级别加载数据
stories = []
try:
    with open('/home/1137757445/turtle_soup_web/static/data/stories.json', 'r', encoding='utf-8') as f:
        stories = json.load(f)
except Exception as e:
    print(f"加载题库出错: {e}")
    # 如果无法加载，使用默认故事
    stories = [
        {
            "title": "神秘的水果",
            "surface": "有人拿着一个水果，经过桥边时掉进了河里，于是人们开始尖叫逃离。",
            "bottom": "这发生在一个迷信的村庄，村民们相信如果神圣的水果接触到河水，就会带来灾难。"
        }
    ]

# 路由：主页
@app.route('/')
def index():
    return render_template('index.html')

# 路由：获取所有题目
@app.route('/api/stories', methods=['GET'])
def get_stories():
    story_titles = [(i, s['title']) for i, s in enumerate(stories)]
    return jsonify(story_titles)

# 路由：获取指定题目
@app.route('/api/story/<int:story_id>', methods=['GET'])
def get_story(story_id):
    if story_id < 0 or story_id >= len(stories):
        return jsonify({"error": "故事ID无效"}), 404

    # 初始化游戏状态
    session['current_story'] = story_id
    session['attempt_count'] = 0
    session['game_history'] = []
    session['game_solved'] = False

    return jsonify({
        "surface": stories[story_id]['surface'],
        "message": "请提问或猜测，AI裁判将回答：是、否、无关",
        "attempts_left": 10
    })

# 路由：提交猜测
@app.route('/api/guess', methods=['POST'])
def submit_guess():
    # 获取游戏状态
    story_id = session.get('current_story')
    attempt_count = session.get('attempt_count', 0)
    game_history = session.get('game_history', [])
    game_solved = session.get('game_solved', False)

    # 校验游戏状态
    if story_id is None or story_id < 0 or story_id >= len(stories):
        return jsonify({"error": "请先选择题目"}), 400

    if game_solved or attempt_count >= 10:
        return jsonify({"error": "游戏已结束"}), 400

    # 获取并处理猜测
    data = request.json
    guess = data.get('guess', '').strip()

    if not guess:
        return jsonify({"error": "请输入有效的问题或猜测"}), 400

    # 获取AI判断
    current_story = stories[story_id]
    judgment = ai_judge(
        current_story['surface'],
        current_story['bottom'],
        guess,
        game_history
    )
    # 判断是否成功
    if "SUCCESS" in judgment:
        game_solved = True
        session['game_solved'] = True

        # 基本成功信息 - 对所有题目都显示玩家最后的猜测
        result = {
            "judgment": "是",
            "success": True,
            "message": "🎉 恭喜你！成功猜出了核心内容！",
            "surface": current_story['surface'],
            "bottom": current_story['bottom'],
            "final_guess": guess  # 这里确保保存了玩家的最终猜测
        }

        # 只有"巨人"故事才添加特殊消息
        if current_story.get('title') == "巨人":
            result["special_message"] = "希望你能快乐健康，早日寻得良人组成爱的巨人。"
    # # 判断是否成功
    # if "SUCCESS" in judgment:
    #     game_solved = True
    #     session['game_solved'] = True
    #     result = {
    #         "judgment": "是",
    #         "success": True,
    #         "message": "🎉 恭喜你！成功猜出了核心内容！",
    #         "surface": current_story['surface'],
    #         "bottom": current_story['bottom']
    #     }
    else:
        # 更新游戏状态
        attempt_count += 1
        session['attempt_count'] = attempt_count
        game_history.append((guess, judgment))
        session['game_history'] = game_history

        result = {"judgment": judgment, "success": False}

        # 检查是否达到最大次数
        if attempt_count >= 10:
            result["message"] = "🎮 游戏结束！已达到最大提问次数(10次)"
            result["surface"] = current_story['surface']
            result["bottom"] = current_story['bottom']
        else:
            result["message"] = f"🤖 AI裁判：{judgment}"
            result["attempts_left"] = 10 - attempt_count
            result["surface"] = current_story['surface']  # 确保在每次回答后都返回题目

    # 更新历史记录
    result["history"] = game_history

    return jsonify(result)

# # 路由：查看答案
# @app.route('/api/reveal', methods=['GET'])
# def reveal_answer():
#     story_id = session.get('current_story')

#     if story_id is None or story_id < 0 or story_id >= len(stories):
#         return jsonify({"error": "请先选择题目"}), 400

#     current_story = stories[story_id]
#     attempt_count = session.get('attempt_count', 0)

#     return jsonify({
#         "surface": current_story['surface'],
#         "bottom": current_story['bottom'],
#         "attempts": attempt_count
#     })

# 路由：查看答案
@app.route('/api/reveal', methods=['GET'])
def reveal_answer():
    story_id = session.get('current_story')

    if story_id is None or story_id < 0 or story_id >= len(stories):
        return jsonify({"error": "请先选择题目"}), 400

    current_story = stories[story_id]
    attempt_count = session.get('attempt_count', 0)

    result = {
        "surface": current_story['surface'],
        "bottom": current_story['bottom'],
        "attempts": attempt_count
    }

    # 添加特殊消息，如果是"巨人"故事
    if current_story.get('title') == "巨人":
        result["special_message"] = "希望你能快乐健康，早日寻得良人组成爱的巨人。"

    return jsonify(result)
# AI裁判逻辑
def ai_judge(surface, bottom, guess, history):
    # 准备历史问答记录
    history_text = ""
    if history:
        history_text = "历史问答记录:\n"
        for i, (q, a) in enumerate(history):
            history_text += f"问{i+1}: {q}\n答{i+1}: {a}\n"

    prompt = f"""作为海龟汤游戏的裁判，你知道完整的故事：
[汤面]: {surface}
[汤底]: {bottom}

玩家的问题或猜测是: "{guess}"

{history_text}

裁判规则：
1. 首先，分析玩家当前猜测与之前的问答历史，判断玩家是否已经猜出了足够还原整个事情真相的内容，如果玩家已经猜出了足够的内容，请回复"SUCCESS"
2. 如果玩家尚未猜出足够的内容和细节，则只回答"是"、"否"或"无关"三个选项之一:
   - "是"：当玩家提出的问题或猜测与汤底描述的事实相符合时
   - "否"：当玩家提出的问题或猜测与汤底描述的事实不符合时
   - "无关"：当玩家问题与解开谜题无关，或问了故事中未提及的细节时

严格要求：
- 不要给出任何提示、解释或额外信息
- 不要透露任何未被玩家猜到的汤底内容
- 回答必须只有一个词："SUCCESS"、"是"、"否"或"无关"
"""

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            temperature=1.0
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"AI调用出错: {e}")
        return "无关"  # 出错时返回默认回应

# if __name__ == '__main__':
#     app.run(debug=True)

# app.py 修改最后一行
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)  # 关闭调试模式！