import { ActionIcon, rem, Tooltip } from "@mantine/core";
import { wrap } from "@reatom/core";
import { reatomComponent } from "@reatom/react";
import { useId, useRef, type KeyboardEvent } from "react";

import { LogoutButton } from "@/features/auth";
import { AppTitle, IconLogo, IconPlus } from "@/shared/ui";

import { createChatForm, createChatOpenAtom } from "../model/create-chat";
import { ChatList } from "./chat-list";
import { CreateChatForm } from "./create-chat-form";

import classes from "./sidebar.module.css";

/**
 * Left column: app header, the new-chat form behind the "+" and the chat list. The form's
 * wrapper stays mounted (a valid `aria-controls` target); the form itself only while open.
 */
export const Sidebar = reatomComponent(({ className }: { className?: string }) => {
  const open = createChatOpenAtom();
  const formId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Drops the number, the error and a request in flight; the focus goes back to the "+" (the
  // field it was in unmounts).
  const close = () => {
    createChatForm.reset();
    createChatOpenAtom.set(false);
    toggleRef.current?.focus();
  };

  return (
    <aside className={className ? `${classes.sidebar} ${className}` : classes.sidebar}>
      <header className={classes.header}>
        <IconLogo size={28} className={classes.logo} />
        <AppTitle size={rem(20)} className={classes.name} />
        <Tooltip label="Новый чат">
          <ActionIcon
            ref={toggleRef}
            variant={open ? "light" : "subtle"}
            color={open ? undefined : "gray"}
            size="lg"
            aria-label="Новый чат"
            aria-expanded={open}
            aria-controls={formId}
            onClick={wrap(() => (open ? close() : createChatOpenAtom.set(true)))}
          >
            <IconPlus />
          </ActionIcon>
        </Tooltip>
        <LogoutButton />
      </header>
      <div
        id={formId}
        className={classes.form}
        hidden={!open}
        onKeyDown={wrap((event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          close();
        })}
      >
        {open && <CreateChatForm />}
      </div>
      <nav className={classes.chats} aria-label="Чаты" tabIndex={-1}>
        <ChatList />
      </nav>
    </aside>
  );
}, "chatPage.Sidebar");
