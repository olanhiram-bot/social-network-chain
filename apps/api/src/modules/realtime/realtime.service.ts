import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, merge } from 'rxjs';

@Injectable()
export class RealtimeService {
  private publicEvents = new Subject<MessageEvent>();
  private userEvents = new Map<string, Subject<MessageEvent>>();

  stream(userId: string): Observable<MessageEvent> {
    return merge(this.publicEvents.asObservable(), this.subjectFor(userId).asObservable());
  }

  publish(type: string, data: Record<string, unknown> = {}) {
    this.publicEvents.next({ type, data });
  }

  publishTo(userId: string, type: string, data: Record<string, unknown> = {}) {
    this.subjectFor(userId).next({ type, data });
  }

  private subjectFor(userId: string) {
    let subject = this.userEvents.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.userEvents.set(userId, subject);
    }
    return subject;
  }
}
