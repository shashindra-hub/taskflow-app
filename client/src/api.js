const BASE_URL = '/api';

async function handleResponse(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  async listTasks(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${BASE_URL}/tasks${query}`);
    return handleResponse(res);
  },

  async createTask({ title, description }) {
    const res = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    return handleResponse(res);
  },

  async toggleTask(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}/toggle`, { method: 'PATCH' });
    return handleResponse(res);
  },

  async updateTask(id, updates) {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  async deleteTask(id) {
    const res = await fetch(`${BASE_URL}/tasks/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },
};
