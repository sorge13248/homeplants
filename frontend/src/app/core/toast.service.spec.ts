import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('should be created with empty toasts array', () => {
    expect(service).toBeTruthy();
    expect(service.toasts().length).toBe(0);
  });

  it('should add a success toast', () => {
    service.success('Operazione completata');
    const list = service.toasts();
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('success');
    expect(list[0].message).toBe('Operazione completata');
  });

  it('should add an error toast', () => {
    service.error('Si è verificato un errore');
    const list = service.toasts();
    expect(list.length).toBe(1);
    expect(list[0].type).toBe('error');
    expect(list[0].message).toBe('Si è verificato un errore');
  });

  it('should dismiss a toast by id', () => {
    service.info('Info message');
    const toastId = service.toasts()[0].id;
    service.dismiss(toastId);
    expect(service.toasts().length).toBe(0);
  });
});

