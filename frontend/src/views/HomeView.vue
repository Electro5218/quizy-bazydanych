<template>
  <div class="home-container">
    <div v-if="!user.isLogged" class="not-logged-in">
      <h1>Witaj w aplikacji</h1>
      <p>Musisz się zalogować, aby uzyskać dostęp do aplikacji.</p>
      <button @click="goLogin" class="login-btn">Zaloguj się</button>
    </div>

    <div v-else>
      <header class="header">
        <div class="header-left">
          <button @click="goChange" class="header-btn">Zmień dane konta</button>
          <button @click="goDelete" class="header-btn">Usuń konto</button>
        </div>
        <button @click="handleLogout" class="logout-btn">Wyloguj</button>
      </header>

      <h1>Witaj w Home</h1>

      <div v-if="user.role === 'student'" class="content">
        <h2>Widok Ucznia</h2>
        <button @click="goGroups" class="groups-btn">Grupy</button>
      </div>

      <div v-if="user.role === 'instructor'" class="content">
        <h2>Widok Instruktora</h2>
        <button @click="goGroups" class="groups-btn">Grupy</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { user, logout } from '../store/user.js'

const router = useRouter()

function goChange() {
  router.push('/change')
}

function goDelete() {
  router.push('/delete')
}

function goGroups() {
  router.push('/groups')
}

function goLogin() {
  router.push('/')
}

function handleLogout() {
  logout()
  router.push('/')
}
</script>

<style scoped>
.home-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  gap: 10px;
}

.header-btn {
  padding: 8px 16px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.logout-btn {
  padding: 8px 16px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.logout-btn:hover {
  background-color: #c82333;
}

.content {
  text-align: center;
  margin-top: 50px;
}

.groups-btn {
  padding: 12px 24px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.not-logged-in {
  text-align: center;
  margin-top: 100px;
}

.login-btn {
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 20px;
}
</style>