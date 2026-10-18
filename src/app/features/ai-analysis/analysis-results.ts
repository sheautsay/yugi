import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { BoardPreview } from '../../shared/board-preview';
import { ComboViewer } from '../../shared/combo/combo-viewer';
import { RouteAnalysisPanel } from '../../shared/combo/route-analysis-panel';
import { AnalysisRunRecord } from './analysis-run-record';
import { ANALYSIS_PAGE } from './analysis-context';

/** Part of the AI analysis page; it reads and changes the page's state through {@link ANALYSIS_PAGE}. */
@Component({
  selector: 'app-analysis-results',
  imports: [NgTemplateOutlet, BoardPreview, ComboViewer, RouteAnalysisPanel, AnalysisRunRecord],
  templateUrl: './analysis-results.html',
  styleUrl: './analysis-page.css',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisResults {
  protected readonly pg = inject(ANALYSIS_PAGE);
}
