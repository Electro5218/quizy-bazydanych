<template>
  <div class="quiz-container">
    <h1>Dodaj quiz</h1>

    <div class="quiz-form">
      <div class="form-group">
        <label>Nazwa:</label>
        <input v-model="quiz.name" />
      </div>

      <div class="form-group">
        <label>Opis:</label>
        <textarea v-model="quiz.description"></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Liczba prób:</label>
          <input v-model.number="quiz.attempts" type="number" />
        </div>

        <div class="form-group">
          <label>Liczba pytań do losowania:</label>
          <input v-model.number="quiz.questionsCount" type="number" />
        </div>

        <div class="form-group">
          <label>Czas wypełniania (minuty):</label>
          <input v-model.number="quiz.timeLimit" type="number" />
        </div>
      </div>

      <div class="form-group">
        <label>
          <input v-model="quiz.visible" type="checkbox" />
          Quiz widoczny od razu
        </label>
      </div>

      <div class="questions-section">
        <h3>Pytania</h3>
        <div v-for="(question, index) in quiz.questions" :key="index" class="question">
          <div class="question-header">
            <select v-model="question.type">
              <option value="single">Jednokrotny wybór</option>
              <option value="multiple">Wielokrotny wybór</option>
            </select>
            <button @click="removeQuestion(index)" class="remove-btn">Usuń</button>
          </div>

          <div class="form-group">
            <label>Treść pytania:</label>
            <textarea v-model="question.text"></textarea>
          </div>

          <div class="answers">
            <label>Możliwe odpowiedzi:</label>
            <div v-for="(answer, ansIndex) in question.answers" :key="ansIndex" class="answer">
              <input v-model="answer.text" placeholder="Odpowiedź" />
              <input v-model="answer.correct" type="checkbox" />
              <label>Poprawna</label>
              <button @click="removeAnswer(index, ansIndex)" class="remove-btn">X</button>
            </div>
            <button @click="addAnswer(index)" class="add-btn">Dodaj odpowiedź</button>
          </div>
        </div>

        <button @click="addQuestion" class="add-question-btn">Dodaj pytanie</button>
      </div>

      <div class="buttons">
        <button @click="saveQuiz" class="save-btn">Zapisz quiz</button>
        <button @click="goBack" class="back-btn">Powrót do widoku grupy</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const quiz = ref({
  name: '',
  description: '',
  attempts: 1,
  questionsCount: 10,
  timeLimit: 30,
  visible: false,
  questions: []
})

function addQuestion() {
  quiz.value.questions.push({
    type: 'single',
    text: '',
    answers: [
      { text: '', correct: false },
      { text: '', correct: false }
    ]
  })
}

function removeQuestion(index) {
  quiz.value.questions.splice(index, 1)
}

function addAnswer(questionIndex) {
  quiz.value.questions[questionIndex].answers.push({
    text: '',
    correct: false
  })
}

function removeAnswer(questionIndex, answerIndex) {
  quiz.value.questions[questionIndex].answers.splice(answerIndex, 1)
}

function saveQuiz() {
  // For now, just show success
  alert('Quiz został zapisany')
  goBack()
}

function goBack() {
  router.push('/groups')
}
</script>

<style scoped>
.quiz-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 15px;
}

.form-row {
  display: flex;
  gap: 15px;
}

.form-row .form-group {
  flex: 1;
}

label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

input, textarea, select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

textarea {
  min-height: 60px;
}

.question {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.answers {
  margin-top: 10px;
}

.answer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
}

.answer input[type="text"] {
  flex: 1;
}

.add-btn, .remove-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-btn {
  background-color: #28a745;
  color: white;
}

.remove-btn {
  background-color: #dc3545;
  color: white;
}

.add-question-btn {
  width: 100%;
  padding: 10px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 20px;
}

.buttons {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.save-btn, .back-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.save-btn {
  background-color: #28a745;
  color: white;
}

.back-btn {
  background-color: #6c757d;
  color: white;
}
</style>