// FitApp Frontend Application
class FitApp {
    constructor() {
        this.currentUser = null;
        this.userChallenges = [];
        this.userRank = null;
        this.currentPage = 'dashboard';
        this.apiUrl = 'http://localhost:3000';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDateTime();
        this.loadUserData();
        this.setupNavigation();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Sync data buttons
        document.getElementById('syncDataBtn')?.addEventListener('click', () => this.syncData());
        document.getElementById('syncDataBtn2')?.addEventListener('click', () => this.syncData());
        
        // Navigation
        document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateToPage(page);
            });
        });

        // Handle hash changes for direct navigation
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            this.navigateToPage(hash);
        });

        // Handle initial hash
        const initialHash = window.location.hash.slice(1) || 'dashboard';
        this.navigateToPage(initialHash);
    }

    setupNavigation() {
        // Update navigation based on current page
        this.updateNavigation();
    }

    updateNavigation() {
        // Update sidebar navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === this.currentPage) {
                item.classList.add('active');
            }
        });

        // Update mobile navigation
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === this.currentPage) {
                item.classList.add('active');
            }
        });
    }

    navigateToPage(page) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Show target page
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = page;
            this.updateNavigation();
            
            // Update URL hash
            window.location.hash = page;
            
            // Load page-specific data
            this.loadPageData(page);
        }
    }

    loadPageData(page) {
        switch (page) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'leaderboard':
                this.loadLeaderboardData();
                break;
            case 'chat':
                this.loadChatData();
                break;
            case 'settings':
                this.loadSettingsData();
                break;
        }
    }

    updateDateTime() {
        const now = new Date();
        
        // Update greeting
        const hour = now.getHours();
        let greeting = 'Good morning';
        if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
        else if (hour >= 17) greeting = 'Good evening';
        
        const greetingEl = document.getElementById('greeting');
        if (greetingEl) {
            greetingEl.textContent = `${greeting}, ${this.currentUser?.name || 'FitApp User'} 👋`;
        }
        
        // Update date
        const dateEl = document.getElementById('currentDate');
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    async loadUserData() {
        try {
            this.showLoading();
            
            // Try to get user from localStorage first
            const storedUser = localStorage.getItem('fitapp_user');
            if (storedUser) {
                this.currentUser = JSON.parse(storedUser);
                this.updateUI();
            }
            
            // Check if user is authenticated
            const token = localStorage.getItem('fitapp_token');
            if (!token) {
                this.redirectToAuth();
                return;
            }
            
            // Fetch fresh user data
            await this.fetchUserData();
            
        } catch (error) {
            console.error('Failed to load user data:', error);
            this.showError('Failed to load user data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async fetchUserData() {
        try {
            const token = localStorage.getItem('fitapp_token');
            if (!token) return;
            
            const response = await fetch(`${this.apiUrl}/api/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                localStorage.setItem('fitapp_user', JSON.stringify(userData));
                this.updateUI();
                
                // Fetch additional data
                await this.fetchUserChallenges();
                await this.fetchUserRank();
            } else if (response.status === 401) {
                this.redirectToAuth();
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
        }
    }

    async fetchUserChallenges() {
        try {
            const token = localStorage.getItem('fitapp_token');
            if (!token || !this.currentUser?.sub) return;
            
            const response = await fetch(`${this.apiUrl}/api/user-challenges/${this.currentUser.sub}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.userChallenges = await response.json();
                this.updateChallengesUI();
            }
        } catch (error) {
            console.error('Failed to fetch user challenges:', error);
        }
    }

    async fetchUserRank() {
        try {
            const token = localStorage.getItem('fitapp_token');
            if (!token || !this.currentUser?.sub) return;
            
            const response = await fetch(`${this.apiUrl}/api/user-rank/${this.currentUser.sub}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.userRank = await response.json();
                this.updateRankUI();
            }
        } catch (error) {
            console.error('Failed to fetch user rank:', error);
        }
    }

    updateUI() {
        if (!this.currentUser) return;
        
        // Update profile
        this.updateProfile();
        
        // Update metrics
        this.updateMetrics();
        
        // Update status
        this.updateStatus();
        
        // Update activity
        this.updateActivity();
        
        // Update quick stats
        this.updateQuickStats();
    }

    updateProfile() {
        const profileName = document.getElementById('profileName');
        const profileInitial = document.getElementById('profileInitial');
        const profileAvatar = document.getElementById('profileAvatar');
        
        if (profileName) {
            profileName.textContent = this.currentUser.name || 'FitApp User';
        }
        
        if (profileInitial) {
            profileInitial.textContent = (this.currentUser.name || 'U').charAt(0).toUpperCase();
        }
        
        if (profileAvatar && this.currentUser.picture) {
            profileAvatar.innerHTML = `<img src="${this.currentUser.picture}" alt="${this.currentUser.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
    }

    updateMetrics() {
        const hasFitnessData = this.currentUser.steps !== null && 
                              this.currentUser.steps !== undefined && 
                              this.currentUser.weight !== null && 
                              this.currentUser.weight !== undefined;
        
        // Update steps
        const stepsValue = document.getElementById('stepsValue');
        if (stepsValue) {
            stepsValue.textContent = hasFitnessData ? this.currentUser.steps.toLocaleString() : '—';
        }
        
        // Update weight
        const weightValue = document.getElementById('weightValue');
        if (weightValue) {
            weightValue.textContent = hasFitnessData ? `${this.currentUser.weight.toFixed(1)} lbs` : '—';
        }
        
        // Update rank
        const rankValue = document.getElementById('rankValue');
        const rankLabel = document.getElementById('rankLabel');
        if (rankValue && rankLabel) {
            if (this.userRank?.rank) {
                rankValue.textContent = `#${this.userRank.rank}`;
                rankLabel.textContent = `Rank of ${this.userRank.totalParticipants}`;
            } else {
                rankValue.textContent = '—';
                rankLabel.textContent = 'Challenge Rank';
            }
        }
    }

    updateStatus() {
        const statusList = document.getElementById('statusList');
        if (!statusList) return;
        
        const hasFitnessData = this.currentUser.steps !== null && 
                              this.currentUser.steps !== undefined && 
                              this.currentUser.weight !== null && 
                              this.currentUser.weight !== undefined;
        
        if (!hasFitnessData) {
            statusList.innerHTML = `
                <div class="status-item">
                    <span class="status-label">Steps Data</span>
                    <span class="status-value warning">⚠️ Setting up...</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Weight Data</span>
                    <span class="status-value warning">⚠️ Setting up...</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Sync</span>
                    <span class="status-value">Never</span>
                </div>
            `;
        } else {
            statusList.innerHTML = `
                <div class="status-item">
                    <span class="status-label">Steps Data</span>
                    <span class="status-value success">✓ Connected</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Weight Data</span>
                    <span class="status-value success">✓ Connected</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Last Sync</span>
                    <span class="status-value">${this.currentUser.lastSync ? new Date(this.currentUser.lastSync).toLocaleString() : 'Never'}</span>
                </div>
            `;
        }
    }

    updateActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        const activities = [
            {
                type: 'success',
                text: 'Fitness data synced successfully',
                time: this.currentUser.lastSync ? new Date(this.currentUser.lastSync).toLocaleTimeString() : '—'
            },
            {
                type: 'info',
                text: 'Dashboard accessed',
                time: 'Just now'
            }
        ];
        
        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <span class="activity-indicator ${activity.type}"></span>
                <span class="activity-text">${activity.text}</span>
                <span class="activity-time">${activity.time}</span>
            </div>
        `).join('');
    }

    updateQuickStats() {
        const quickSteps = document.getElementById('quickSteps');
        const quickWeight = document.getElementById('quickWeight');
        
        if (quickSteps) {
            quickSteps.textContent = this.currentUser.steps !== null && this.currentUser.steps !== undefined ? 
                this.currentUser.steps.toLocaleString() : '—';
        }
        
        if (quickWeight) {
            quickWeight.textContent = this.currentUser.weight !== null && this.currentUser.weight !== undefined ? 
                `${this.currentUser.weight.toFixed(1)} lbs` : '—';
        }
    }

    updateChallengesUI() {
        const challengesSection = document.getElementById('challengesSection');
        const challengesList = document.getElementById('challengesList');
        
        if (!challengesSection || !challengesList) return;
        
        if (this.userChallenges.length === 0) {
            challengesSection.style.display = 'none';
            return;
        }
        
        challengesSection.style.display = 'block';
        challengesList.innerHTML = this.userChallenges.map((challenge, index) => `
            <div class="challenge-item">
                <h4 class="challenge-title">${challenge.name || `Challenge ${index + 1}`}</h4>
                <div class="challenge-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min((challenge.currentSteps / challenge.targetSteps) * 100, 100)}%"></div>
                    </div>
                    <div class="progress-text">
                        ${challenge.currentSteps?.toLocaleString() || 0} / ${challenge.targetSteps?.toLocaleString() || 0} steps
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateRankUI() {
        // Rank is already updated in updateMetrics()
    }

    async syncData() {
        try {
            this.showLoading();
            
            // Call the sync endpoint
            const token = localStorage.getItem('fitapp_token');
            if (!token) {
                this.redirectToAuth();
                return;
            }
            
            const response = await fetch(`${this.apiUrl}/api/sync-fitness-data`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Refresh user data
                await this.fetchUserData();
                this.showSuccess('Data synced successfully!');
            } else {
                const error = await response.json();
                this.showError(error.message || 'Failed to sync data');
            }
        } catch (error) {
            console.error('Sync failed:', error);
            this.showError('Failed to sync data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async loadDashboardData() {
        // Dashboard data is loaded by default
        // Additional dashboard-specific data can be loaded here
    }

    async loadLeaderboardData() {
        try {
            const token = localStorage.getItem('fitapp_token');
            if (!token) return;
            
            const response = await fetch(`${this.apiUrl}/api/leaderboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const leaderboardData = await response.json();
                this.updateLeaderboardUI(leaderboardData);
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    updateLeaderboardUI(leaderboardData) {
        const leaderboardContent = document.getElementById('leaderboardContent');
        if (!leaderboardContent) return;
        
        if (!leaderboardData || leaderboardData.length === 0) {
            leaderboardContent.innerHTML = `
                <div class="text-center">
                    <p class="text-gray-500">No leaderboard data available</p>
                </div>
            `;
            return;
        }
        
        leaderboardContent.innerHTML = `
            <div class="leaderboard-grid">
                ${leaderboardData.map((entry, index) => `
                    <div class="leaderboard-item ${entry.userId === this.currentUser?.sub ? 'current-user' : ''}">
                        <div class="rank">#${index + 1}</div>
                        <div class="user-info">
                            <div class="user-name">${entry.name || 'Anonymous'}</div>
                            <div class="user-steps">${entry.steps?.toLocaleString() || 0} steps</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async loadChatData() {
        // Chat functionality can be implemented here
        const chatContent = document.getElementById('chatContent');
        if (chatContent) {
            chatContent.innerHTML = `
                <div class="text-center">
                    <p class="text-gray-500">Chat functionality coming soon</p>
                </div>
            `;
        }
    }

    async loadSettingsData() {
        // Settings functionality can be implemented here
        const settingsContent = document.getElementById('settingsContent');
        if (settingsContent) {
            settingsContent.innerHTML = `
                <div class="settings-grid">
                    <div class="setting-item">
                        <h3>Account Settings</h3>
                        <p>Manage your account preferences</p>
                    </div>
                    <div class="setting-item">
                        <h3>Privacy</h3>
                        <p>Control your data privacy</p>
                    </div>
                    <div class="setting-item">
                        <h3>Notifications</h3>
                        <p>Configure notification preferences</p>
                    </div>
                </div>
            `;
        }
    }

    startAutoRefresh() {
        // Auto-refresh user data every 5 minutes
        setInterval(() => {
            if (this.currentUser?.sub) {
                this.fetchUserData();
            }
        }, 5 * 60 * 1000);
    }

    redirectToAuth() {
        // Redirect to auth page or show login modal
        window.location.href = '/login';
    }

    showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('show');
        }
    }

    hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('show');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
        
        // Close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FitApp();
});

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification-success {
        border-left: 4px solid #10B981;
    }
    
    .notification-error {
        border-left: 4px solid #EF4444;
    }
    
    .notification-info {
        border-left: 4px solid #3B82F6;
    }
    
    .notification-message {
        flex: 1;
        color: #374151;
        font-size: 14px;
    }
    
    .notification-close {
        background: none;
        border: none;
        font-size: 20px;
        color: #9CA3AF;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
    }
    
    .notification-close:hover {
        background: #F3F4F6;
        color: #6B7280;
    }
    
    .leaderboard-grid {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    
    .leaderboard-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.2s ease;
    }
    
    .leaderboard-item:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        transform: translateY(-1px);
    }
    
    .leaderboard-item.current-user {
        border: 2px solid #035FC3;
        background: #F0F7FF;
    }
    
    .rank {
        font-size: 18px;
        font-weight: 700;
        color: #035FC3;
        min-width: 40px;
    }
    
    .user-info {
        flex: 1;
    }
    
    .user-name {
        font-weight: 600;
        color: #1F2937;
        margin-bottom: 4px;
    }
    
    .user-steps {
        font-size: 14px;
        color: #6B7280;
    }
    
    .challenge-title {
        font-size: 16px;
        font-weight: 600;
        color: #1F2937;
        margin-bottom: 12px;
    }
    
    .challenge-progress {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    
    .progress-bar {
        width: 100%;
        height: 8px;
        background: #E5E7EB;
        border-radius: 4px;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        background: #035FC3;
        transition: width 0.3s ease;
    }
    
    .progress-text {
        font-size: 14px;
        color: #6B7280;
        text-align: center;
    }
    
    .settings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 24px;
    }
    
    .setting-item {
        background: white;
        padding: 24px;
        border-radius: 16px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        transition: all 0.2s ease;
    }
    
    .setting-item:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        transform: translateY(-2px);
    }
    
    .setting-item h3 {
        margin-bottom: 8px;
        color: #1F2937;
    }
    
    .setting-item p {
        color: #6B7280;
        font-size: 14px;
    }
`;

document.head.appendChild(notificationStyles);
