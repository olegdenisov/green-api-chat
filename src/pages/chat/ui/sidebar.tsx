import { LogoutButton } from "@/features/auth";
import { AppTitle, IconLogo } from "@/shared/ui";

import { ChatList } from "./chat-list";
import { CreateChatForm } from "./create-chat-form";

import classes from "./sidebar.module.css";

/** Left column: app header, the new-chat form and the chat list. */
export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={className ? `${classes.sidebar} ${className}` : classes.sidebar}>
      <header className={classes.header}>
        <IconLogo size={28} className={classes.logo} />
        <AppTitle size="h3" className={classes.name} />
        <LogoutButton />
      </header>
      <div className={classes.form}>
        <CreateChatForm />
      </div>
      <nav className={classes.chats} aria-label="Чаты">
        <ChatList />
      </nav>
    </aside>
  );
}
