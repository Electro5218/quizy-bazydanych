<template>
  <div class="change-container">
    <h1>Zmień dane konta</h1>

    <div v-if="loading" class="loading">Ładowanie...</div>

    <div v-else class="form">
      <h3>Dane profilu</h3>
      <div class="form-group">
        <label>Email:</label>
        <input v-model="email" type="email" />
      </div>
      <div class="form-group">
        <label>Nick (username):</label>
        <input v-model="username" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Imię:</label>
          <input v-model="firstName" />
        </div>
        <div class="form-group">
          <label>Nazwisko:</label>
          <input v-model="lastName" />
        </div>
      </div>

      <h3 class="section-title">Zmiana hasła <span class="optional">(opcjonalne)</span></h3>
      <div class="form-group">
        <label>Aktualne hasło:</label>
        <input v-model="currentPassword" type="password" />
      </div>
      <div class="form-group">
        <label>Nowe hasło (min. 8 znaków):</label>
        <input v-model="newPassword" type="password" />
      </div>
      <div class="form-group">
        <label>Potwierdź nowe hasło:</label>
        <input v-model="confirmPassword" type="password" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="success" class="success">{{ success }}</p>

      <div class="buttons">
        <button @click="save" class="save-btn">Zatwierdź</button>
        <button @click="router.push('/home')" class="back-btn">Powrót do Home</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index.js'

const router = useRouter()
const loading = ref(true)
const userId = ref(null)
const email = ref('')
const username = ref('')
const firstName = ref('')
const lastName = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const success = ref('')

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/me')
    userId.value = data.id
    email.value = data.email || ''
    username.value = data.username || ''
    firstName.value = data.first_name || ''
    lastName.value = data.last_name || ''
  } catch {
    error.value = 'Błąd ładowania danych'
  } finally {
    loading.value = false
  }
})

async function save() {
  error.value = ''
  success.value = ''

  if (!username.value.trim()) return (error.value = 'Nick nie może być pusty')

  const anyPasswordField = currentPassword.value || newPassword.value || confirmPassword.value
  if (anyPasswordField) {
    if (!currentPassword.value) return (error.value = 'Podaj aktualne hasło')
    if (newPassword.value.length < 8) return (error.value = 'Nowe hasło musi mieć minimum 8 znaków')
    if (newPassword.value !== confirmPassword.value) return (error.value = 'Nowe hasła nie są identyczne')
  }

  try {
    await api.put(`/users/${userId.value}`, {
      email: email.value.trim() || null,
      username: username.value.trim(),
      first_name: firstName.value.trim() || null,
      last_name: lastName.value.trim() || null
    })

    if (anyPasswordField) {
      await api.put(`/users/${userId.value}/password`, {
        current_password: currentPassword.value,
        new_password: newPassword.value
      })
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    }

    success.value = 'Dane zostały zapisane pomyślnie!'
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd zapisu danych'
  }
}
</script>

<style scoped>
.change-container { max-width: 500px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
.loading { text-align: center; padding: 20px; color: #999; }
.form-group { margin-bottom: 14px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 14px; }
input { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
.section-title { margin: 24px 0 12px; font-size: 16px; border-top: 1px solid #eee; padding-top: 16px; }
.optional { font-size: 13px; font-weight: normal; color: #888; }
.buttons { display: flex; gap: 10px; margin-top: 20px; }
.save-btn, .back-btn { flex: 1; padding: 10px; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; font-weight: 600; }
.save-btn { background: #28a745; color: white; }
.back-btn { background: #6c757d; color: white; }
.error { color: #dc3545; margin: 8px 0; }
.success { color: #28a745; margin: 8px 0; }
</style>
