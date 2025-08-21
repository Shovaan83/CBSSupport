"use strict";

class NotificationManager {
    constructor(isAdmin = false, userId = null) {
        this.isAdmin = isAdmin;
        this.userId = userId;
        this.prefix = isAdmin ? 'admin' : 'user';
        this.notifications = [];
        this.unreadCount = 0;

        this.initializeElements();
        this.bindEvents();
        this.loadNotifications();
        this.startPolling();
    }

    initializeElements() {
        if (this.isAdmin) {
            this.notificationBtns = [
                document.getElementById('admin-notification-btn'),
                document.getElementById('admin-notification-btn-chats'),
                document.getElementById('admin-notification-btn-tickets'),
                document.getElementById('admin-notification-btn-inquiries')
            ].filter(btn => btn !== null); 

            this.notificationBadges = [
                document.getElementById('admin-notification-badge'),
                document.getElementById('admin-notification-badge-chats'),
                document.getElementById('admin-notification-badge-tickets'),
                document.getElementById('admin-notification-badge-inquiries')
            ].filter(badge => badge !== null); 

            this.notificationDropdown = document.getElementById('admin-notification-dropdown');
            this.notificationList = document.getElementById('admin-notification-list');
            this.markAllReadBtn = document.getElementById('admin-mark-all-read');
            this.viewAllBtn = document.getElementById('admin-view-all-notifications');
        } else {
            this.notificationBtn = document.getElementById(`${this.prefix}-notification-btn`);
            this.notificationBadge = document.getElementById(`${this.prefix}-notification-badge`);
            this.notificationDropdown = document.getElementById(`${this.prefix}-notification-dropdown`);
            this.notificationList = document.getElementById(`${this.prefix}-notification-list`);
            this.markAllReadBtn = document.getElementById(`${this.prefix}-mark-all-read`);
            this.viewAllBtn = document.getElementById(`${this.prefix}-view-all-notifications`);
        }
    }

    bindEvents() {
        if (this.isAdmin) {
            this.notificationBtns.forEach(btn => {
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleDropdown(btn);
                    });
                }
            });
        } else {
            if (this.notificationBtn) {
                this.notificationBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleDropdown();
                });
            }
        }

        if (this.markAllReadBtn) {
            this.markAllReadBtn.addEventListener('click', () => {
                this.markAllAsRead();
            });
        }

        document.addEventListener('click', (e) => {
            if (this.notificationDropdown && !this.notificationDropdown.contains(e.target)) {
                const clickedOnNotificationBtn = this.isAdmin
                    ? this.notificationBtns.some(btn => btn && btn.contains(e.target))
                    : this.notificationBtn && this.notificationBtn.contains(e.target);

                if (!clickedOnNotificationBtn) {
                    this.hideDropdown();
                }
            }
        });

        if (this.notificationList) {
            this.notificationList.addEventListener('click', (e) => {
                const notificationItem = e.target.closest('.notification-item');
                if (notificationItem) {
                    const notificationId = parseInt(notificationItem.dataset.id);
                    this.handleNotificationClick(notificationId);
                }
            });
        }
    }

    async loadNotifications() {
        try {
            const endpoint = this.isAdmin ?
                `/v1/api/notification/admin/${this.userId}` :
                `/v1/api/notification/user/${this.userId}`;

            const response = await fetch(endpoint);
            if (response.ok) {
                this.notifications = await response.json();
                this.updateUnreadCount();
                this.renderNotifications();
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    async loadUnreadCount() {
        try {
            const endpoint = this.isAdmin ?
                `/v1/api/notification/admin/${this.userId}/count` :
                `/v1/api/notification/user/${this.userId}/count`;

            const response = await fetch(endpoint);
            if (response.ok) {
                const data = await response.json();
                this.unreadCount = data.count;
                this.updateBadge();
            }
        } catch (error) {
            console.error('Failed to load unread count:', error);
        }
    }

    updateUnreadCount() {
        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        this.updateBadge();
    }

    updateBadge() {
        if (this.isAdmin) {
            this.notificationBadges.forEach(badge => {
                if (badge) {
                    if (this.unreadCount > 0) {
                        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
                        badge.style.display = 'flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            });
        } else {
            if (this.notificationBadge) {
                if (this.unreadCount > 0) {
                    this.notificationBadge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
                    this.notificationBadge.style.display = 'flex';
                } else {
                    this.notificationBadge.style.display = 'none';
                }
            }
        }
    }

    renderNotifications() {
        if (!this.notificationList) return;

        if (this.notifications.length === 0) {
            this.notificationList.innerHTML = `
                <div class="notification-empty">
                    <p class="text-muted text-center">No new notifications</p>
                </div>`;
            return;
        }

        const notificationsHtml = this.notifications.map(notification => {
            const timeAgo = this.getTimeAgo(new Date(notification.createdAt));
            return `
                <div class="notification-item ${!notification.isRead ? 'unread' : ''}" data-id="${notification.id}">
                    <div class="notification-title">${this.escapeHtml(notification.title)}</div>
                    <div class="notification-message">${this.escapeHtml(notification.message)}</div>
                    <div class="notification-time">${timeAgo}</div>
                </div>`;
        }).join('');

        this.notificationList.innerHTML = notificationsHtml;
    }

    toggleDropdown(clickedBtn = null) {
        if (this.notificationDropdown) {
           
            if (this.notificationDropdown.classList.contains('show')) {
                this.hideDropdown();
                return;
            }

           
            if (this.isAdmin && clickedBtn) {
                this.positionDropdown(clickedBtn);
            }

            this.notificationDropdown.classList.add('show');
            if (this.notificationDropdown.classList.contains('show')) {
                this.loadNotifications(); 
            }
        }
    }

    positionDropdown(clickedBtn) {
        if (!this.notificationDropdown || !clickedBtn) return;

        const btnRect = clickedBtn.getBoundingClientRect();
        const dropdown = this.notificationDropdown;

        dropdown.style.position = 'fixed';
        dropdown.style.top = `${btnRect.bottom + 5}px`;
        dropdown.style.left = `${btnRect.left - 300}px`; 
        dropdown.style.zIndex = '1050';
    }

    hideDropdown() {
        if (this.notificationDropdown) {
            this.notificationDropdown.classList.remove('show');
        }
    }

    async markAsRead(notificationId) {
        try {
            const response = await fetch(`/v1/api/notification/${notificationId}/read`, {
                method: 'PUT'
            });

            if (response.ok) {
                const notification = this.notifications.find(n => n.id === notificationId);
                if (notification) {
                    notification.isRead = true;
                    this.updateUnreadCount();
                    this.renderNotifications();
                }
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }

    async markAllAsRead() {
        try {
            const endpoint = this.isAdmin ?
                `/v1/api/notification/admin/${this.userId}/read-all` :
                `/v1/api/notification/user/${this.userId}/read-all`;

            const response = await fetch(endpoint, { method: 'PUT' });

            if (response.ok) {
                this.notifications.forEach(n => n.isRead = true);
                this.updateUnreadCount();
                this.renderNotifications();
            }
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }

    async handleNotificationClick(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        if (!notification.isRead) {
            await this.markAsRead(notificationId);
        }

        if (notification.data) {
            try {
                const data = JSON.parse(notification.data);
                this.navigateBasedOnNotification(data, notification.type);
            } catch (error) {
                console.error('Failed to parse notification data:', error);
            }
        }

        this.hideDropdown();
    }

    navigateBasedOnNotification(data, type) {
        switch (data.action) {
            case 'view_ticket':
                if (this.isAdmin) {
                    if (window.navigateToTicketManagement) {
                        window.navigateToTicketManagement();
                    }
                } else {
                    console.log('Navigate to ticket:', data.ticketId);
                }
                break;
            case 'view_inquiry':
                if (this.isAdmin) {
                    if (window.navigateToInquiryManagement) {
                        window.navigateToInquiryManagement();
                    }
                } else {
                    console.log('Navigate to inquiry:', data.inquiryId);
                }
                break;
            case 'open_chat':
                if (this.isAdmin) {
                    $('.admin-sidebar .nav-link.active').removeClass('active');
                    $('.admin-sidebar .nav-link[data-page="chats"]').addClass('active');
                    $('.admin-page.active').removeClass('active');
                    $('#chats-page').addClass('active');
                    if (window.pageInitializers && window.pageInitializers.chats) {
                        window.pageInitializers.chats();
                    }
                } else {
                    console.log('Navigate to chat:', data.conversationId);
                    if (window.openConversation) {
                        window.openConversation(data.conversationId);
                    }
                }
                break;
        }
    }

    addNotification(notification) {
        this.notifications.unshift(notification);

        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.updateUnreadCount();
        this.renderNotifications();

        this.showToast(notification);
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = 'notification-toast';
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${this.escapeHtml(notification.title)}</div>
                <div class="toast-message">${this.escapeHtml(notification.message)}</div>
            </div>
        `;

        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 5000);

      
        toast.addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'new_ticket': return 'fa-ticket-alt';
            case 'new_inquiry': return 'fa-question-circle';
            case 'new_message': return 'fa-comment';
            case 'ticket_updated': return 'fa-edit';
            case 'inquiry_updated': return 'fa-edit';
            default: return 'fa-bell';
        }
    }

    startPolling() {
        
        setInterval(() => {
            this.loadUnreadCount();
        }, 30000);
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        if (text === null || typeof text === 'undefined') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}


const notificationStyles = `
<style>
/* Notification Styles */
.notification-container {
    position: relative;
    display: inline-block;
}

.notification-btn {
    background: none;
    border: 1px solid #dee2e6;
    color: #6c757d;
    padding: 8px 12px;
    position: relative;
    border-radius: 6px;
    transition: all 0.3s ease;
}

.notification-btn:hover {
    background-color: #f8f9fa;
    color: #495057;
    border-color: #adb5bd;
}

.notification-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #dc3545;
    color: white;
    border-radius: 50%;
    padding: 2px 6px;
    font-size: 11px;
    font-weight: bold;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
}

.notification-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 350px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1050;
    display: none;
    max-height: 400px;
    overflow: hidden;
}

.notification-dropdown.show {
    display: block;
}

.notification-header {
    padding: 12px 16px;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
}

.notification-header h6 {
    margin: 0;
    font-weight: 600;
    color: #495057;
}

.notification-list {
    max-height: 300px;
    overflow-y: auto;
}

.notification-item {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f3f4;
    cursor: pointer;
    transition: background-color 0.2s ease;
    position: relative;
}

.notification-item:hover {
    background-color: #f8f9fa;
}

.notification-item.unread {
    background-color: #e3f2fd;
    border-left: 3px solid #2196f3;
}

.notification-item.unread::before {
    content: '';
    position: absolute;
    top: 50%;
    right: 16px;
    width: 8px;
    height: 8px;
    background: #2196f3;
    border-radius: 50%;
    transform: translateY(-50%);
}

.notification-title {
    font-weight: 600;
    color: #212529;
    margin-bottom: 4px;
    font-size: 14px;
}

.notification-message {
    color: #6c757d;
    font-size: 13px;
    line-height: 1.4;
    margin-bottom: 4px;
}

.notification-time {
    color: #8e9bae;
    font-size: 11px;
}

.notification-empty {
    padding: 32px 16px;
    text-align: center;
}

.notification-footer {
    padding: 8px 16px;
    border-top: 1px solid #dee2e6;
    background: #f8f9fa;
}

.notification-footer a {
    color: #0066cc;
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
}

.notification-footer a:hover {
    text-decoration: underline;
}

/* Toast notification styles */
.notification-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 16px;
    width: 300px;
    z-index: 9999;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    cursor: pointer;
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.notification-toast.show {
    transform: translateX(0);
}

.toast-icon {
    color: #0066cc;
    font-size: 18px;
    margin-top: 2px;
}

.toast-content {
    flex: 1;
}

.toast-title {
    font-weight: 600;
    color: #212529;
    margin-bottom: 4px;
    font-size: 14px;
}

.toast-message {
    color: #6c757d;
    font-size: 13px;
    line-height: 1.4;
}
</style>
`;

document.head.insertAdjacentHTML('beforeend', notificationStyles);


window.NotificationManager = NotificationManager;