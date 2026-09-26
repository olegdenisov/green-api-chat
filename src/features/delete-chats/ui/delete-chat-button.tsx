import { ActionIcon, Button, Group, Popover, Text } from "@mantine/core";
import { useWrap } from "@reatom/react";
import { useState } from "react";

import { IconTrash } from "@/shared/ui";

import { deleteChat } from "../model/delete-chats";

export function DeleteChatButton({ chatId }: { chatId: string }) {
  const [opened, setOpened] = useState(false);
  const confirm = useWrap(() => {
    setOpened(false);
    deleteChat(chatId);
  }, "deleteChats.DeleteChatButton.confirm");

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      withArrow
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="red"
          size="lg"
          aria-label="Удалить чат"
          onClick={() => setOpened((value) => !value)}
        >
          <IconTrash />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Text size="sm" mb="xs">
          Удалить чат и историю?
        </Text>
        <Group gap="xs" justify="flex-end">
          <Button size="xs" variant="default" onClick={() => setOpened(false)}>
            Отмена
          </Button>
          <Button size="xs" color="red" onClick={confirm}>
            Удалить
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
