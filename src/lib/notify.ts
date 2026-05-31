export const notify = (message: string, title: string = 'Notification', action?: {label: string, onClick: () => void}) => {
    window.dispatchEvent(new CustomEvent('app-notify', { detail: { title, message, action } }));
};
