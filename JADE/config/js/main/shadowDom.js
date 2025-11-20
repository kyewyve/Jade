export function friendCustomBG(element) {
    const root = element.shadowRoot;
    const rootStyle = document.createElement("style");
    rootStyle.textContent = `
		:host .lol-uikit-full-page-modal 
		{
			background: transparent;
			backdrop-filter: blur(10px);
		}
		:host .lol-uikit-full-page-modal-frame .lol-uikit-full-page-modal-frame-left
		{
			display: none;
		}
		:host .lol-uikit-full-page-modal-close-button-frame .lol-uikit-full-page-modal-close-button-outer
		{
			background: transparent;
			border-color: transparent;
		}
		:host .lol-uikit-full-page-modal-close-button-frame .lol-uikit-full-page-modal-close-button-inner
		{
			background: transparent;
			border-color: transparent;
		}
    `;
    root.appendChild(rootStyle);
}