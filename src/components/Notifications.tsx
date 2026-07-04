import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { translations } from '../lib/locales';

export const Notifications = () => {
    const [notifications, setNotifications] = useState([]);
    const lang = localStorage.getItem('lang') || 'ar';
    const t = translations[lang];
    
    const fetchNotifications = async () => {
        try {
            const tokenString = localStorage.getItem('auth_token');
            const token = (tokenString && tokenString !== "null") ? tokenString.replace(/^"|"$/g, '') : null;
            
            if (!token) return;

            const response = await fetch('/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) return;

            const data = await response.json();
            
            // Check for new notifications to trigger toast
            if (notifications.length > 0 && data.length > notifications.length) {
                toast.success(t.newNotifications);
            }
            
            setNotifications(data);
        } catch (error: any) {
            // Only log if it's not a transient fetch failure
            if (error?.message !== 'Failed to fetch') {
                console.error('Error fetching notifications:', error);
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // Polling every 60s to be safe
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (action: string, notifId: string) => {
        toast(`${t.approve}: ${action}`);
    };

    return (
        <div className="space-y-6 text-right">
            <h1 className="text-2xl font-black text-black">{t.notifications}</h1>
            {notifications.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">لا توجد إشعارات جديدة حالياً.</p>
            ) : (
                <div className="space-y-4">
                    {notifications.map((n: any, index: number) => (
                        <div key={`${n.id || 'notif'}-${index}`} className="p-4 bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-700 space-y-2">
                            <p className="text-black dark:text-neutral-200">{n.message}</p>
                            <div className="flex gap-2">
                                {(n.message.includes('password') || n.message.includes('رمز')) && (
                                    <button onClick={() => handleAction(t.changePassword, n.id)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">{t.changePassword}</button>
                                )}
                                {(n.message.includes('approval') || n.message.includes('موافقة')) && (
                                    <button onClick={() => handleAction(t.approve, n.id)} className="text-xs bg-green-500 text-white px-2 py-1 rounded">{t.approve}</button>
                                )}
                            </div>
                            <span className="text-xs text-neutral-400">{new Date(n.createdAt).toLocaleString('en-US')}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
