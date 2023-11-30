import axios from "axios";
import { Observable, Subscriber } from "rxjs";

export interface NotificationFilter {
  unread: boolean;
  participating: boolean;
}

export interface Thread {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  last_read_at?: string;
  url: string;
  subscription_url: string;
  subject: {
    title: string;
    url: string;
    latest_comment_url: string;
    type: string;
  };
  repository: {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    html_url: string;
    description?: string;
    fork: boolean;
  };
}

const _fetchNotifications = <T>(
  config: {
    observer: Subscriber<T>;
    token: string;
    fallbackPollIntervalSecs: number;
  },
  filter: NotificationFilter,
  lastModified?: string
) => {
  axios
    .get<T>(
      `https://api.github.com/notifications?all=${filter.unread}&participating=${filter.participating}`,
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(lastModified && { "If-Modified-Since": lastModified }),
        },
      }
    )
    .then(({ headers, status, data }) => {
      const tokenExpirationDate = new Date(
        headers["github-authentication-token-expiration"]
      );
      // Throw if token is expired
      if (tokenExpirationDate < new Date()) {
        config.observer.error("GitHub token is expired");
        return;
      }

      const lastModifiedRes: string = headers["Last-Modified"];

      const refetchCb = () =>
        setTimeout(
          () => _fetchNotifications(config, filter, lastModifiedRes),
          (headers["x-poll-interval"] ?? config.fallbackPollIntervalSecs) * 1000
        );

      // If there are no new notifications, refetch
      if (status === 304) {
        refetchCb();
        // If there are new notifications, emit them and refetch
      } else if (status >= 200 && status < 300) {
        config.observer.next(data);
        refetchCb();
      } else {
        config.observer.error(`Unexpected status code: ${status}`);
      }
    })
    .catch((err) => {
      config.observer.error(err);
    });
};

export const githubNotifications = (
  token: string,
  filter: NotificationFilter = { unread: false, participating: false },
  config: { fallbackPollIntervalSecs: number } = {
    fallbackPollIntervalSecs: 60,
  }
) => {
  return new Observable<Thread[]>((observer) => {
    _fetchNotifications(
      {
        observer,
        token,
        ...config,
      },
      filter
    );
  });
};
