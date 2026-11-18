import { useCallback, useState } from 'react';
import { useAuthStore } from '../../../stores/authStore';
import { GUIDED_NODES } from '../nodes';
import type { GuidedNode, GuidedOption } from '../types';

export function useGuidedAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string>('ROOT');
  const [historyStack, setHistoryStack] = useState<string[]>([]);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const currentNode: GuidedNode = GUIDED_NODES[currentNodeId] ?? GUIDED_NODES.ROOT;

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const openAssistant = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
  }, []);

  const resetToRoot = useCallback(() => {
    setCurrentNodeId('ROOT');
    setHistoryStack([]);
  }, []);

  const goToNode = useCallback((nodeId: string) => {
    if (!GUIDED_NODES[nodeId]) return;
    setCurrentNodeId((current) => {
      setHistoryStack((stack) => [...stack, current]);
      return nodeId;
    });
  }, []);

  const goBack = useCallback(() => {
    setHistoryStack((stack) => {
      if (stack.length === 0) {
        setCurrentNodeId('ROOT');
        return [];
      }
      const prev = stack[stack.length - 1];
      const newStack = stack.slice(0, -1);
      setCurrentNodeId(prev);
      return newStack;
    });
  }, []);

  const handleSelectOption = useCallback(
    (option: GuidedOption, navigate: (to: string) => void) => {
      if (option.isHome) {
        resetToRoot();
        return;
      }

      if (option.isBack) {
        goBack();
        return;
      }

      // Validación de autenticación si la opción o ruta la exige
      if (option.requiresAuth && !isAuthenticated) {
        goToNode('AUTH_REQUERIDA');
        return;
      }

      if (option.route) {
        navigate(option.route);
        closeAssistant();
        return;
      }

      if (option.nextNode) {
        goToNode(option.nextNode);
      }
    },
    [isAuthenticated, resetToRoot, goBack, goToNode, closeAssistant],
  );

  return {
    isOpen,
    toggleOpen,
    openAssistant,
    closeAssistant,
    currentNode,
    historyStack,
    canGoBack: historyStack.length > 0 || currentNodeId !== 'ROOT',
    goToNode,
    goBack,
    resetToRoot,
    handleSelectOption,
  };
}
