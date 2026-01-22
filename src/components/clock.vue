<script setup>
import {ref,onMounted,onUnmounted} from 'vue'
import moment from 'moment'
const times = ref([
  {name:'Mon',isActive:false},
  {name:'Tue',isActive:false},
  {name:'Wed',isActive:false},
  {name:'Thu',isActive:false},
  {name:'Fri',isActive:false},
  {name:'Sat',isActive:false},
  {name:'Sun',isActive:false}
])
const currentTime = ref('')
const ampm = ref('')
// 初始化时间
const updateClock = () => {
  const now = moment()
  currentTime.value = now.format('hh:mm:ss')
  ampm.value = now.format('A')
  const currentDay = now.format('ddd')
  times.value.forEach((item) => {
    item.isActive = item.name === currentDay
  })
}
onMounted(() => {
  updateClock()
  const interval = setInterval(updateClock,1000)
  onUnmounted(() => {
    clearInterval(interval)
  })
})
</script>

<template>
  <div id="clock" class="dark">
    <div class="display">
      <div class="weekdays">
        <span v-for="(day,index) in times" :key="index" :class="{active:day.isActive}">{{ day.name }}</span>
      </div>
      <div class="time-container">
        <div class="digits">{{ currentTime }}</div>
        <div class="ampm">{{ ampm }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#clock {
  position: relative;
  width: 220px;
  height: 60px;
  margin: auto;
  padding: 5px 10px;
  border-radius: 8px;
  background: rgba(0, 40, 80, 0.4);
  border: 1px solid rgba(0, 162, 255, 0.3);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
}

.display {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.time-container {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.weekdays {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 2px;
}

.weekdays span {
  font-size: 10px;
  opacity: 0.3;
  color: #fff;
}

.weekdays span.active {
  opacity: 1;
  color: #00a2ff;
  font-weight: bold;
}

.digits {
  font-size: 22px;
  font-weight: bold;
  font-family: 'Monaco', 'Courier New', monospace;
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 162, 255, 0.5);
}

.ampm {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-weight: bold;
}

/* 移除污染全局的样式 */
</style>

