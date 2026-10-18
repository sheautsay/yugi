import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ANALYSIS_PAGE } from './analysis-context';

/** Part of the AI analysis page; it reads and changes the page's state through {@link ANALYSIS_PAGE}. */
@Component({
  selector: 'app-analysis-history',
  imports: [RouterLink],
  templateUrl: './analysis-history.html',
  styleUrl: './analysis-page.css',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisHistory {
  protected readonly pg = inject(ANALYSIS_PAGE);
}
