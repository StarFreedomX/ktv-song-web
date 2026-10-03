<script setup>
defineProps({ title: String });
</script>

<template>
    <section class="remote-panel">
        <header v-if="title || $slots.header" class="remote-panel-heading">
            <slot name="header"><h2>{{ title }}</h2></slot>
        </header>
        <slot />
    </section>
</template>
