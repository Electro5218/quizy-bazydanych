<template>
  <div class="reset-container">
    <h1>Reset hasła</h1>

    <div v-if="!emailSent" class="form">
      <div class="form-group">
        <input v-model="email" placeholder="Email" type="email" />
      </div>

      <button @click="reset" class="reset-btn">Przypomnij</button>
    </div>

    <div v-else class="success">
      <p>Mail został wysłany!</p>
    </div>

    <button @click="goLogin" class="back-btn">Powrót do logowania</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const email = ref('')
const emailSent = ref(false)

function reset() {
  // For now, just show success message
  emailSent.value = true
}

function goLogin() {
  router.push('/')
}
</script>

<style scoped>
.reset-container {
  max-width: 400px;
  margin: 50px auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.reset-btn, .back-btn {
  width: 100%;
  padding: 10px;
  margin-top: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.reset-btn {
  background-color: #007bff;
  color: white;
}

.back-btn {
  background-color: #6c757d;
  color: white;
}

.success {
  text-align: center;
  margin: 20px 0;
  color: #28a745;
  font-weight: bold;
}
</style>