/**
 * 遮罩层点击关闭。
 *
 * 只按 @click.self 判断会有个坑：在弹窗里按住鼠标选中文字，拖到遮罩上再松手时，
 * 浏览器把这个 click 派发到 mousedown / mouseup 的公共祖先，也就是遮罩本身，
 * 于是弹窗被当成“点了背景”关掉，正在复制的内容一起丢失。
 *
 * 这里额外记录按下时的位置，只有按下和松开都落在遮罩上才算真正的背景点击。
 * 和 antd / MUI / Element Plus / VueUse 的处理思路一致。
 */
export function useBackdropClose(close) {
    let pressedOnBackdrop = false;

    const onBackdropPointerDown = (event) => {
        pressedOnBackdrop = event.target === event.currentTarget;
    };

    const onBackdropClick = (event) => {
        const isBackdropClick = pressedOnBackdrop && event.target === event.currentTarget;
        pressedOnBackdrop = false;
        if (isBackdropClick) {
            close();
        }
    };

    return { onBackdropPointerDown, onBackdropClick };
}
