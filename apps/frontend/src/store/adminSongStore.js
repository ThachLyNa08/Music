import { defineStore } from 'pinia';
import api from '@/api/axios';

export const useAdminSongStore = defineStore('adminSong', {
  state: () => ({
    selectedGroup: 'ALL', // KPOP, VPOP, USUK, ALL
    groupsSummary: [],
    songs: [],
    statistics: null,
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1
    },
    filters: {
      search: '',
      genreId: '',
      status: '',
      releaseStatus: '',
      sortBy: 'created_at',
      sortOrder: 'DESC'
    },
    loading: {
      summary: false,
      songs: false,
      statistics: false,
      bulk: false
    }
  }),
  actions: {
    async fetchGroupsSummary() {
      this.loading.summary = true;
      try {
        const res = await api.get('/admin/songs/groups/summary');
        this.groupsSummary = res.data.data || [];
      } catch (err) {
        console.error('Lỗi tải summary:', err);
      } finally {
        this.loading.summary = false;
      }
    },
    async fetchSongs() {
      this.loading.songs = true;
      try {
        const { search, genreId, status, releaseStatus, sortBy, sortOrder } = this.filters;
        const params = {
          group: this.selectedGroup,
          page: this.pagination.page,
          limit: this.pagination.limit,
          search, genreId, status, releaseStatus, sortBy, sortOrder
        };
        const res = await api.get('/admin/songs', { params });
        this.songs = res.data.data || [];
        if (res.data.pagination) {
          this.pagination = res.data.pagination;
        }
      } catch (err) {
        console.error('Lỗi tải bài hát:', err);
      } finally {
        this.loading.songs = false;
      }
    },
    async fetchStatistics() {
      this.loading.statistics = true;
      try {
        const res = await api.get('/admin/songs/statistics', {
          params: { group: this.selectedGroup }
        });
        this.statistics = res.data.data;
      } catch (err) {
        console.error('Lỗi tải thống kê:', err);
      } finally {
        this.loading.statistics = false;
      }
    },
    setSelectedGroup(group) {
      if (this.selectedGroup === group) return;
      this.selectedGroup = group;
      this.pagination.page = 1;
      this.fetchSongs();
      this.fetchStatistics();
    },
    setPage(page) {
      const safePage = Math.min(
        Math.max(Number(page) || 1, 1),
        this.pagination.totalPages || 1
      );
      if (this.pagination.page === safePage) return;
      this.pagination.page = safePage;
      this.fetchSongs();
    },
    applyFilters() {
      this.pagination.page = 1;
      this.fetchSongs();
    },
    resetFilters() {
      this.filters = {
        search: '',
        genreId: '',
        status: '',
        releaseStatus: '',
        sortBy: 'created_at',
        sortOrder: 'DESC'
      };
      this.applyFilters();
    },
    async bulkUpdateStatus(songIds, status) {
      this.loading.bulk = true;
      try {
        await api.patch('/admin/songs/bulk-status', { songIds, status });
        await this.fetchSongs();
        await this.fetchGroupsSummary();
      } catch (err) {
        throw err;
      } finally {
        this.loading.bulk = false;
      }
    },
    async bulkUpdateMarket(songIds, market) {
      this.loading.bulk = true;
      try {
        await api.patch('/admin/songs/bulk-market', { songIds, market });
        await this.fetchSongs();
        await this.fetchGroupsSummary();
        await this.fetchStatistics();
      } catch (err) {
        throw err;
      } finally {
        this.loading.bulk = false;
      }
    }
  }
});
