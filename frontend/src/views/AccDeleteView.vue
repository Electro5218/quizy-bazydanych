<template>
  <div class="delete-container">
    <h1>Usuń konto</h1>

    <div class="info">
      <p>Usunięcie konta jest <strong>nieodwracalne</strong>. Twoje dane zostaną dezaktywowane.</p>
      <p v-if="user.role === 'instructor'" class="warn">
        Uwaga: jako instruktor posiadasz grupy i quizy — po usunięciu konta nie będą one dostępne dla studentów.
      </p>
    </div>

    <button v-if="!showConfirm" @click="showConfirm = true" class="delete-btn">Usuń konto</button>

    <div v-if="showConfirm" class="confirmation">
      <p>Czy na pewno chcesz usunąć konto?</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="confirm-btns">
        <button @click="confirmDelete" class="confirm-btn">Tak, usuń</button>
        <button @click="showConfirm = false" class="cancel-btn">Anuluj</button>
      </div>
    </div>

    <button @click="router.push('/home')" class="back-btn">Powrót do Home</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { user, logout } from '../store/user.js'
import api from '../api/index.js'

const router = useRouter()
const showConfirm = ref(false)
const error = ref('')
const userId = ref(null)

onMounted(async () => {
  try {
    const { data } = await api.get('/auth/me')
    userId.value = data.id
  } catch {
    error.value = 'Błąd ładowania danych konta'
  }
})

async function confirmDelete() {
  error.value = ''
  try {
    await api.delete(`/users/${userId.value}`)
    logout()
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Błąd usuwania konta'
  }
}
</script>

<style scoped>
.delete-container { max-width: 500px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
.info { margin-bottom: 24px; }
.warn { color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px; margin-top: 8px; }
.delete-btn { padding: 10px 24px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; font-weight: 600; }
.confirmation { margin: 20px 0; padding: 16px; background: #fff5f5; border: 1px solid #f5c6cb; border-radius: 6px; }
.confirm-btns { display: flex; gap: 10px; margin-top: 12px; }
.confirm-btn { padding: 8px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; }
.cancel-btn { padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.back-btn { margin-top: 20px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; display: block; }
.error { color: #dc3545; margin: 8px 0; }
</style>
