// static/js/script.js
document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const storyDropdown = document.getElementById('storyDropdown');
    const guessInput = document.getElementById('guessInput');
    const submitBtn = document.getElementById('submitBtn');
    const revealBtn = document.getElementById('revealBtn');
    const quitBtn = document.getElementById('quitBtn');
    const attemptsLabel = document.getElementById('attemptsLabel');
    const outputArea = document.getElementById('outputArea');
    const historyContent = document.getElementById('historyContent');

    // 当前选择的storyId，用于前端状态管理
    let currentStoryId = null;

    // 加载故事列表
    fetch('/api/stories')
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应错误');
            }
            return response.json();
        })
        .then(data => {
            // 清空下拉菜单
            storyDropdown.innerHTML = '<option value="" selected disabled>请选择题目</option>';

            // 添加故事选项
            data.forEach(([id, title]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = title;
                storyDropdown.appendChild(option);
            });
        })
        .catch(error => {
            console.error('获取故事列表失败:', error);
            outputArea.textContent = '加载故事列表失败，请刷新页面重试。';
        });

    // 选择故事事件
    storyDropdown.addEventListener('change', function() {
        const storyId = this.value;
        if (!storyId) return;
        
        // 保存当前选择的storyId
        currentStoryId = storyId;

        fetch(`/api/story/${storyId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('网络响应错误');
                }
                return response.json();
            })
            .then(data => {
                // 重置游戏状态
                resetGameUI();

                // 更新UI
                outputArea.innerHTML = `<p>📖 汤面：${data.surface}</p><p>${data.message}</p>`;
                attemptsLabel.textContent = `剩余提问次数: ${data.attempts_left}`;

                // 启用输入
                guessInput.disabled = false;
                submitBtn.disabled = false;
            })
            .catch(error => {
                console.error('获取故事失败:', error);
                outputArea.textContent = `加载故事失败: ${error.message}，请重试。`;
            });
    });

    // 提交猜测事件
    submitBtn.addEventListener('click', function() {
        const guess = guessInput.value.trim();
        if (!guess) {
            alert('请输入有效的问题或猜测');
            return;
        }

        // 禁用按钮防止重复提交
        submitBtn.disabled = true;

        // 显示加载状态
        outputArea.innerHTML = '<p>🔄 AI裁判思考中...</p>';

        fetch('/api/guess', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ guess })
        })
        .then(response => {
            if (!response.ok) {
                // 处理HTTP错误（如400、500等）
                return response.json().then(data => {
                    throw new Error(data.error || '服务器错误');
                });
            }
            return response.json();
        })
        .then(data => {
            // 清空输入框
            guessInput.value = '';

            // 创建输出内容
            let outputHTML = '';

            // 如果有汤面信息，先显示汤面
            if (data.surface) {
                outputHTML += `<p>📖 汤面：${data.surface}</p>`;
            } else if (currentStoryId !== null) {
                // 如果汤面丢失但知道storyId，尝试获取汤面（防止undefined）
                // 注：这是一个额外的保护措施
                console.log('尝试从当前storyId恢复汤面');
                try {
                    const currentStory = storyDropdown.options[storyDropdown.selectedIndex].text;
                    outputHTML += `<p>📖 当前题目: ${currentStory}</p>`;
                } catch (e) {
                    console.error('无法恢复汤面:', e);
                }
            }

            // 添加AI裁判的回答
            outputHTML += `<p>${data.message}</p>`;

            // 如果游戏结束，显示汤底
            if (data.bottom) {
                outputHTML += `<p>🔍 汤底：${data.bottom}</p>`;

                // 对所有题目都显示最终猜测
                if (data.final_guess) {
                    outputHTML += `<p>🎯 成功猜测：${data.final_guess}</p>`;
                }

                // 只有对特定题目才显示特殊消息 - 使用红色加粗样式
                if (data.special_message) {
                    outputHTML += `<p>💌 <strong style="color: red;">${data.special_message}</strong></p>`;
                }

                guessInput.disabled = true;
                submitBtn.disabled = true;
            } else {
                // 重新启用提交按钮
                submitBtn.disabled = false;
            }

            // 使用innerHTML来支持HTML格式
            outputArea.innerHTML = outputHTML;

            // 如果有剩余次数信息，更新它
            if (data.attempts_left !== undefined) {
                attemptsLabel.textContent = `剩余提问次数: ${data.attempts_left}`;
            }

            // 更新历史记录
            updateHistory(data.history);
        })
        .catch(error => {
            console.error('提交猜测失败:', error);
            outputArea.innerHTML = `<p>提交失败：${error.message}，请重试。</p>`;
            
            // 如果是会话过期或选题错误，提示用户重新选择题目
            if (error.message.includes('请先选择题目')) {
                outputArea.innerHTML += '<p>您的会话可能已过期，请重新选择题目。</p>';
                // 重置UI
                resetGameUI();
            } else {
                // 其他错误情况下，重新启用提交按钮
                submitBtn.disabled = false;
            }
        });
    });

    // 查看答案事件
    revealBtn.addEventListener('click', function() {
        fetch('/api/reveal')
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || '服务器错误');
                    });
                }
                return response.json();
            })
            .then(data => {
                let outputHTML = `<p>📖 汤面：${data.surface}</p>`;
                outputHTML += `<p>🔍 汤底：${data.bottom}</p>`;
                outputHTML += `<p>💡 你已经提问了 ${data.attempts} 次</p>`;

                // 如果有特殊消息
                if (data.special_message) {
                    outputHTML += `<p>💌 <strong style="color: red;">${data.special_message}</strong></p>`;
                }

                outputArea.innerHTML = outputHTML;
                
                // 禁用输入框
                guessInput.disabled = true;
                submitBtn.disabled = true;
            })
            .catch(error => {
                console.error('查看答案失败:', error);
                
                if (error.message.includes('请先选择题目')) {
                    outputArea.innerHTML = '<p>请先选择题目</p>';
                } else {
                    outputArea.innerHTML = `<p>查看答案失败：${error.message}，请重试。</p>`;
                }
            });
    });

    // 退出游戏事件
    quitBtn.addEventListener('click', function() {
        resetGameUI();
        storyDropdown.value = '';
        currentStoryId = null;
        outputArea.innerHTML = '<p>请选择一个题目开始游戏</p>';
    });

    // 输入框回车事件
    guessInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !submitBtn.disabled) {
            submitBtn.click();
        }
    });

    // 更新历史记录
    function updateHistory(history) {
        if (!history || !Array.isArray(history)) return;

        historyContent.innerHTML = '';

        history.forEach((item, index) => {
            const [question, answer] = item;
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';

            const questionEl = document.createElement('div');
            questionEl.className = 'question';
            questionEl.textContent = `${index + 1}. 问：${question}`;

            const answerEl = document.createElement('div');
            answerEl.className = 'answer';
            answerEl.textContent = `   答：${answer}`;

            historyItem.appendChild(questionEl);
            historyItem.appendChild(answerEl);
            historyContent.appendChild(historyItem);
        });
    }

    // 重置游戏UI
    function resetGameUI() {
        guessInput.value = '';
        guessInput.disabled = true;
        submitBtn.disabled = true;
        attemptsLabel.textContent = '剩余提问次数: 10';
        historyContent.innerHTML = '';
    }
});