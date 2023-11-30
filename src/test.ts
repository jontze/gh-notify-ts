import { githubNotifications } from "./notification";

githubNotifications(process.env.GITHUB_TOKEN!, {
  unread: true,
  participating: false,
}).subscribe({
  next: (data) => {
    data.forEach((not) => {
      console.debug(not);
    });
  },
  error: (error) => console.error(error),
});
