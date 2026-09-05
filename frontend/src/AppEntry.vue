<template>
    <div :class="['mx-auto', ['RoomHistory', 'RoomHistoryTransfer', 'RoomArchive'].includes(route.name) ? 'max-w-4xl' : 'max-w-md']">
        <router-view></router-view>
    </div>
</template>

<script setup>
import { useRoute } from 'vue-router';
const route = useRoute();
</script>
