import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideImage } from "../slide-image";

describe("SlideImage", () => {
  it("shows the image initially", () => {
    const { container } = render(
      <SlideImage src="https://cdn.test/1.png" label="Slide 1" />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.test/1.png",
    );
  });

  it("renders an explicit failed state (and drops the image) on load error", () => {
    const { container } = render(
      <SlideImage src="https://cdn.test/2.png" label="Slide 2" />,
    );
    fireEvent.error(container.querySelector("img")!);

    expect(screen.getByText("Slide 2 failed to load.")).toBeInTheDocument();
    // The failed <img> is gone, so no stale previous-slide frame can persist.
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("retries with a cache-busted src", () => {
    const { container } = render(
      <SlideImage src="https://cdn.test/3.png" label="Slide 3" />,
    );
    fireEvent.error(container.querySelector("img")!);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img?.getAttribute("src")).toContain("retry=1");
    expect(screen.queryByText(/failed to load/)).not.toBeInTheDocument();
  });
});
