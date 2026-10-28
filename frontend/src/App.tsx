import { lazy, Suspense } from "react";
import ScrollToTop from "./components/common/ScrollToTop";
import SplashScreen from "./components/common/SplashScreen";
import MainLayout from "./layouts/MainLayout";
import AppRouter from "./routes/AppRouter";

const ChatbotWidget = lazy(() => import("./features/chatbot/components/ChatbotWidget"));

export default function App() {
  return (
    <MainLayout>
      <ScrollToTop />
      <SplashScreen />
      <AppRouter />
      <Suspense fallback={null}>
        <ChatbotWidget />
      </Suspense>
    </MainLayout>
  );
}
