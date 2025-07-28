"use strict";

document.addEventListener('DOMContentLoaded', function () {
    // --- DOM & STATE ---
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link[data-view]');
    const viewContainers = document.querySelectorAll('.view-container');
    const headerTitle = document.querySelector('.main-header h3');

    let ticketsDataTable;
    let solvedTicketsChart;

    // --- HELPERS ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const renderStatusBadge = (status) => {
        const statusMap = {
            0: { text: 'Open', class: 'bg-status-open' },
            1: { text: 'Pending', class: 'bg-status-pending' },
            2: { text: 'Resolved', class: 'bg-status-resolved' },
            3: { text: 'Closed', class: 'bg-status-closed' }
        };
        const s = statusMap[status] || { text: 'Unknown', class: 'bg-secondary' };
        return `<span class="badge ${s.class}">${s.text}</span>`;
    };

    const renderPriorityBadge = (priority) => {
        const priorityMap = {
            0: { text: 'Low', class: 'bg-priority-low' },
            1: { text: 'Medium', class: 'bg-priority-medium' },
            2: { text: 'High', class: 'bg-priority-high' },
            3: { text: 'Urgent', class: 'bg-priority-urgent' }
        };
        const p = priorityMap[priority] || { text: 'N/A', class: 'bg-secondary' };
        return `<span class="badge ${p.class}">${p.text}</span>`;
    };

    // --- VIEW NAVIGATION ---
    function switchView(viewId) {
        viewContainers.forEach(container => {
            container.style.display = container.id === `view-${viewId}` ? 'block' : 'none';
        });

        sidebarLinks.forEach(link => {
            if (link.dataset.view === viewId) {
                link.classList.add('active');
                headerTitle.textContent = link.textContent.trim();
            } else {
                link.classList.remove('active');
            }
        });

        // Load data for the activated view
        if (viewId === 'dashboard') loadDashboardData();
        if (viewId === 'tickets') loadTicketsData();
    }

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = e.currentTarget.dataset.view;
            if (viewId) {
                switchView(viewId);
            }
        });
    });

    // --- DATA LOADING & RENDERING ---
    async function loadDashboardData() {
        try {
            const response = await fetch('/api/tickets/dashboard-stats');
            if (!response.ok) throw new Error('Failed to fetch dashboard stats');
            const stats = await response.json();

            document.getElementById('stat-total-tickets').textContent = stats.totalTickets;
            document.getElementById('stat-new-tickets').textContent = stats.newTickets;
            document.getElementById('stat-open-tickets').textContent = stats.openTickets;
            document.getElementById('stat-closed-tickets').textContent = stats.closedTickets;

            // Chart.js implementation
            const ctx = document.getElementById('solvedTicketsChart').getContext('2d');
            if (solvedTicketsChart) {
                solvedTicketsChart.destroy();
            }
            solvedTicketsChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'], // Mock labels
                    datasets: [{
                        label: 'Solved Tickets',
                        data: [65, 59, 80, 81, 56, 55, 40], // Mock data
                        fill: false,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }]
                }
            });

        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    function loadTicketsData() {
        if (ticketsDataTable) {
            ticketsDataTable.ajax.reload();
            return;
        }

        ticketsDataTable = $('#ticketsDataTable').DataTable({
            processing: true,
            serverSide: false, // Set to true if you implement server-side paging/filtering
            ajax: {
                url: '/api/tickets',
                dataSrc: ''
            },
            columns: [
                { data: 'id', render: (d) => `#${d}` },
                { data: 'subject' },
                { data: 'createdByFullName' },
                { data: 'createdAt', render: formatDate },
                { data: 'priority', render: renderPriorityBadge },
                { data: 'status', render: renderStatusBadge },
                { data: 'assignedToName', defaultContent: 'Unassigned' },
                {
                    data: null,
                    orderable: false,
                    searchable: false,
                    render: function (data, type, row) {
                        // This connects back to your existing client chat!
                        // The user name is passed in the query string.
                        return `
                            <button class="btn btn-sm btn-primary" title="View Details"><i class="fas fa-eye"></i></button>
                            <a href="/chat?userToChatWith=${encodeURIComponent(row.createdByFullName)}" target="_blank" class="btn btn-sm btn-success" title="Chat with User"><i class="fas fa-comments"></i></a>
                        `;
                    }
                }
            ],
            order: [[3, 'desc']] // Order by creation date descending
        });
    }

    // --- INITIALIZATION ---
    switchView('dashboard'); // Show dashboard on page load
});