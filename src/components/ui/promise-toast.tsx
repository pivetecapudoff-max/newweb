"use client";

import { Button } from "@/components/ui/button";
import { toastManager } from "@/components/ui/toast";

export default function PromiseToast() {
  return (
    <Button
      onClick={() => {
        toastManager.promise(
          new Promise((resolve, reject) => {
            const shouldSucceed = Math.random() > 0.2;
            setTimeout(() => {
              if (shouldSucceed) {
                resolve("Ação concluída com sucesso");
              } else {
                reject(new Error("Falha ao sincronizar dados"));
              }
            }, 1500);
          }),
          {
            error: (err) => ({
              description: err?.message || "Tente novamente mais tarde.",
              title: "Algo deu errado",
            }),
            loading: {
              description: "Processando requisição no Roblox...",
              title: "Carregando…",
            },
            success: (data) => ({
              description: String(data),
              title: "Concluído com Sucesso!",
            }),
          }
        );
      }}
      variant="outline"
    >
      Testar Notificação
    </Button>
  );
}
