import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const socket = io();

type Conversation = { id: string; type: 'group' | 'personal'; name: string; };

export const Conversations = () => {
  const [activeType, setActiveType] = useState<'group' | 'personal'>('personal');
  const [activeChat, setActiveChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    // Request permission once on mount  
    if (Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    socket.on('chatMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socket.on('newNotification', (msg) => {
      // Trigger notification if permission granted
      if (Notification.permission === 'granted') {
          new Notification('رسالة جديدة', {
              body: msg.content || 'صورة جديدة',
          });
      }
    });
    return () => { 
        socket.off('chatMessage'); 
        socket.off('newNotification');
    };
  }, []);

  const conversations: Conversation[] = [
    { id: '1', type: 'personal', name: 'أحمد محمد' },
    { id: '2', type: 'group', name: 'محادثة الشركات' },
  ];

  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const sendMessage = async () => {
    if ((!message && !file) || !activeChat) return;

    const formData = new FormData();
    if (message) formData.append('message', message);
    if (file) formData.append('photo', file);
    formData.append('chatId', activeChat.id);

    try {
      const response = await fetch('/api/send-telegram', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (response.ok) {
        const newMsg = { 
          content: message, 
          image: imagePreview,
          sender: 'أنت'
        };
        setMessages([...messages, newMsg]);
        socket.emit('chatMessage', newMsg);
        setMessage('');
        setFile(null);
        setImagePreview(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to send message:', errorData);
        alert('فشل إرسال الرسالة: ' + (errorData.error || 'خطأ غير معروف'));
      }
    } catch (error) {
      console.error('Failed to send:', error);
    }
  };

  return (
    <div className="grid grid-cols-[300px,1fr] gap-6 p-6 h-[600px]">
      {/* Sidebar: Conversations List */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 p-4">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveType('personal')} className={`flex-1 ${activeType === 'personal' ? 'bg-indigo-600 text-white' : 'bg-white'} p-2 rounded-xl transition`}>شخصية</button>
          <button onClick={() => setActiveType('group')} className={`flex-1 ${activeType === 'group' ? 'bg-indigo-600 text-white' : 'bg-white'} p-2 rounded-xl transition`}>جماعية</button>
        </div>
        <div className="space-y-2">
          {conversations.filter(c => c.type === activeType).map(chat => (
            <button key={chat.id} onClick={() => setActiveChat(chat)} className={`w-full text-right p-3 rounded-lg ${activeChat?.id === chat.id ? 'bg-indigo-100 text-indigo-900' : 'hover:bg-indigo-100/50'}`}>
              {chat.name}
            </button>
          ))}
        </div>
      </div>
{/* Main: Messages Area */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col justify-between shadow-sm">
        {activeChat ? (
            <>
                <div className="flex-1 my-4 overflow-y-auto space-y-3">
                    {messages.map((msg, idx) => (
                        <div key={idx} className="p-3 bg-indigo-50 rounded-2xl max-w-[80%]">
                            {msg.sender && <div className="text-xs text-indigo-600 font-bold mb-1">{msg.sender}</div>}
                            {msg.image && (
                                <img src={msg.image} alt="رسالة" className="max-w-[200px] rounded-lg mb-2 shadow-sm" />
                            )}
                            {msg.content && <p className="text-neutral-800">{msg.content}</p>}
                        </div>
                    ))}
                    {messages.length === 0 && <div className="text-neutral-500 text-center mt-10">لا توجد رسائل بعد...</div>}
                </div>
                {imagePreview && (
                  <div className="relative mb-2 w-max">
                      <img src={imagePreview} className="max-h-32 rounded-lg border-2 border-indigo-200 shadow-md" alt="preview" />
                      <button onClick={() => { setFile(null); setImagePreview(null); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full text-white w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">×</button>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-neutral-100">
                    <input 
                        className="flex-1 p-3 bg-neutral-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none" 
                        placeholder="اكتب رسالة..." 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                    <button className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition" onClick={sendMessage}>ارسال</button>
                    <input type="file" id="imageInput" className="hidden" onChange={handleFileChange} />
                    <label htmlFor="imageInput" className="p-4 bg-neutral-100 rounded-2xl cursor-pointer hover:bg-neutral-200 transition">📷</label>
                </div>
            </>
        ) : (
            <div className="text-center text-neutral-500 flex items-center justify-center flex-1">اختر محادثة للبدء</div>
        )}
      </div>
    </div>
  );
};
