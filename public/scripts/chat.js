// Chat panel client script - communicates with UX agent and hot-renders UI
(function() {
  'use strict';

  const chatPanel = document.getElementById('chat-panel');
  if (!chatPanel) return;

  const messagesContainer = chatPanel.querySelector('.chat-messages');
  const chatInput = chatPanel.querySelector('.chat-input');
  const sendBtn = chatPanel.querySelector('.chat-send-btn');
  const toggleBtn = document.getElementById('chat-toggle-btn');

  // Extract userId from URL path /ui/<userId>
  const pathParts = window.location.pathname.split('/');
  const userId = pathParts[pathParts.indexOf('ui') + 1] || 'default';

  // Toggle chat panel visibility
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      chatPanel.classList.toggle('collapsed');
      toggleBtn.textContent = chatPanel.classList.contains('collapsed') ? '💬' : '✕';
    });
  }

  function addMessage(content, role = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message chat-message-${role}`;
    msgDiv.textContent = content;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-message chat-message-assistant chat-loading';
    loadingDiv.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return loadingDiv;
  }

  function removeLoadingMessage(loadingDiv) {
    if (loadingDiv && loadingDiv.parentNode) {
      loadingDiv.parentNode.removeChild(loadingDiv);
    }
  }

  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    chatInput.disabled = true;
    sendBtn.disabled = true;

    addMessage(message, 'user');
    const loadingDiv = addLoadingMessage();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message })
      });

      const result = await response.json();
      removeLoadingMessage(loadingDiv);

      if (result.success) {
        addMessage('✅ UI updated! Refreshing...', 'assistant');
        // Hot render: fetch new HTML and replace main content
        setTimeout(() => hotRenderUI(), 500);
      } else {
        addMessage('❌ Error: ' + (result.error || 'Unknown error'), 'assistant');
      }
    } catch (err) {
      removeLoadingMessage(loadingDiv);
      addMessage('❌ Network error: ' + err.message, 'assistant');
    } finally {
      chatInput.disabled = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  }

  async function hotRenderUI() {
    try {
      // Fetch the updated HTML for this userId
      const response = await fetch(`/api/ui-html/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch updated UI');
      
      const html = await response.text();
      
      // Parse the HTML and extract the main content area
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find the main content container (works for dashboard and portal templates)
      const newContent = doc.querySelector('.dashboard-container, .portal-container, .kanban-board');
      const currentContent = document.querySelector('.dashboard-container, .portal-container, .kanban-board');
      
      if (newContent && currentContent) {
        // Replace the content while preserving the chat panel
        currentContent.innerHTML = newContent.innerHTML;
        addMessage('🎉 UI refreshed successfully!', 'assistant');
      } else {
        // Fallback: full page reload
        window.location.reload();
      }
    } catch (err) {
      console.error('[chat] Hot render failed, reloading page:', err);
      window.location.reload();
    }
  }

  // Event listeners
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Initial greeting
  addMessage('👋 Hi! Describe the UI you want and I\'ll generate it for you.', 'assistant');
})();
