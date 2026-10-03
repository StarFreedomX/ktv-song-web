<script setup>
// Lucide icons (ISC): https://github.com/lucide-icons/lucide/tree/main/icons
// License: public/third-party/Lucide-LICENSE.txt
const props = defineProps({ name: { type: String, required: true } });
const icons = {
    "chevron-down": [
        {
            "tag": "path",
            "attrs": {
                "d": "m6 9 6 6 6-6"
            }
        }
    ],
    "skip-back": [
        {
            "tag": "path",
            "attrs": {
                "d": "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z"
            }
        },
        {
            "tag": "path",
            "attrs": {
                "d": "M3 20V4"
            }
        }
    ],
    "skip-forward": [
        {
            "tag": "path",
            "attrs": {
                "d": "M21 4v16"
            }
        },
        {
            "tag": "path",
            "attrs": {
                "d": "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"
            }
        }
    ],
    "pause": [
        {
            "tag": "rect",
            "attrs": {
                "x": "14",
                "y": "3",
                "width": "5",
                "height": "18",
                "rx": "1"
            }
        },
        {
            "tag": "rect",
            "attrs": {
                "x": "5",
                "y": "3",
                "width": "5",
                "height": "18",
                "rx": "1"
            }
        }
    ],
    "play": [
        {
            "tag": "path",
            "attrs": {
                "d": "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
            }
        }
    ],
    "minus": [
        {
            "tag": "path",
            "attrs": {
                "d": "M5 12h14"
            }
        }
    ],
    "plus": [
        {
            "tag": "path",
            "attrs": {
                "d": "M5 12h14"
            }
        },
        {
            "tag": "path",
            "attrs": {
                "d": "M12 5v14"
            }
        }
    ],
    "pencil": [
        {
            "tag": "path",
            "attrs": {
                "d": "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
            }
        },
        {
            "tag": "path",
            "attrs": {
                "d": "m15 5 4 4"
            }
        }
    ]
};
</script>

<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <component :is="node.tag" v-for="(node, index) in icons[props.name]" :key="index" v-bind="node.attrs" />
    </svg>
</template>
