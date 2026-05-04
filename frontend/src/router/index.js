import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import PassResetView from '../views/PassResetView.vue'
import HomeView from '../views/HomeView.vue'
import ChangeInfoView from '../views/ChangeInfoView.vue'
import AccDeleteView from '../views/AccDeleteView.vue'
import GroupsView from '../views/GroupsView.vue'
import AddQuizView from '../views/AddQuizView.vue'
import GroupDetailView from '../views/GroupDetailView.vue'
import QuizTakeView from '../views/QuizTakeView.vue'
import QuizResultsView from '../views/QuizResultsView.vue'

const routes = [
  { path: '/', component: LoginView },
  { path: '/register', component: RegisterView },
  { path: '/reset', component: PassResetView },
  { path: '/home', component: HomeView },
  { path: '/change', component: ChangeInfoView },
  { path: '/delete', component: AccDeleteView },
  { path: '/groups', component: GroupsView },
  { path: '/add-quiz', component: AddQuizView },
  { path: '/group/:name', component: GroupDetailView },
  { path: '/group/:groupName/quiz/:quizId', name: 'quiz-view', component: QuizTakeView },
  { path: '/group/:groupName/results/:quizId', name: 'quiz-results', component: QuizResultsView }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router