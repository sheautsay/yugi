import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ANALYSIS_PAGE } from './analysis-context';

/** Part of the AI analysis page; it reads and changes the page's state through {@link ANALYSIS_PAGE}. */
@Component({
  selector: 'app-analysis-run-record',
  imports: [],
  templateUrl: './analysis-run-record.html',
  styleUrl: './analysis-page.css',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisRunRecord {
  protected readonly pg = inject(ANALYSIS_PAGE);
}
