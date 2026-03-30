import { ref } from 'vue'

const savedUserData = localStorage.getItem('user')
let savedUser = null

try {
  savedUser = savedUserData ? JSON.parse(savedUserData) : null
} catch (e) {
  console.warn('Error parsing user data from localStorage:', e)
  savedUser = null
}

export const user = ref(
  savedUser || {
    isLogged: false,
    role: null
  }
)

export function login(role) {
  user.value = {
    isLogged: true,
    role
  }

  localStorage.setItem('user', JSON.stringify(user.value))
}

export function logout() {
  user.value = {
    isLogged: false,
    role: null
  }

  localStorage.removeItem('user')
}