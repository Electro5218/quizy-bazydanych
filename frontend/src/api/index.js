import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      // Nie przekierowuj na login gdy sam endpoint logowania zwraca 401
      const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register')
      if (!isAuthCall) {
        localStorage.removeItem('token')
        window.location.href = '/'
      }
    }
    return Promise.reject(error)
  }
)

export default api
